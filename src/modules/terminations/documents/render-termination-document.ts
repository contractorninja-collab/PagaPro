import type { TerminationType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCompanyAssetStorage } from "@/lib/company-asset-storage";
import { buildMergedPlaceholderContext } from "@/modules/documents/services/build-placeholder-context";
import { composePlaceholderRegistry } from "@/modules/documents/engine/placeholders/registry";
import { generateDocxFromTemplate } from "@/modules/documents/engine/generate-docx";
import { StorageNotFoundError } from "@/modules/documents/engine/storage/key-safety";
import { resolveBundledTerminationTemplate } from "./bundled-termination-template";

const DOCX_CONTENT_TYPE =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

export type RenderTerminationResult =
  | { ok: true; buffer: Buffer; filename: string; contentType: string }
  | { ok: false; error: string };

function asciiSlug(value: string): string {
  // NFD splits accented letters into base + combining mark; the non-alphanumeric
  // replace then drops the marks, so "Reçica" -> "Recica".
  return (
    value
      .normalize("NFD")
      .replace(/[^A-Za-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "") || "x"
  );
}

/**
 * Renders a termination's decision document to a DOCX buffer, in memory, without
 * persisting anything.
 *
 * The template source is taken from storage when the seeded blob is present, and
 * otherwise from the repo's committed `templates/termination/` DOCX. That
 * fallback is what makes the register's "Shkarko" button work on a serverless
 * deployment with no object store, where the seeded blob was written to an
 * ephemeral disk and lost. Because nothing is written back, this needs no
 * writable filesystem and no bucket.
 */
export async function renderTerminationDocument(
  companyId: string,
  terminationId: string,
  /** Which template to print. Defaults to the one matching the termination's own type. */
  templateType?: TerminationType,
): Promise<RenderTerminationResult> {
  const term = await prisma.termination.findFirst({
    where: { id: terminationId, companyId },
    include: { employee: true },
  });
  if (!term) return { ok: false, error: "Largimi nuk u gjet." };
  if (term.status === "CANCELLED") return { ok: false, error: "Largimi është anuluar." };

  const chosenType = templateType ?? term.type;

  const template = await prisma.documentTemplate.findFirst({
    where: {
      companyId,
      documentCategory: "TERMINATION",
      terminationWorkflowKey: chosenType,
      isActive: true,
    },
    include: {
      versions: {
        where: { isPublished: true },
        orderBy: { versionNumber: "desc" },
        take: 1,
      },
    },
  });

  // Resolve the template bytes: seeded blob first, committed repo file second.
  let templateDocxBuffer: Buffer | null = null;
  const version = template?.versions[0] ?? null;
  if (version) {
    try {
      templateDocxBuffer = await getCompanyAssetStorage().get(version.sourceStorageKey);
    } catch (err) {
      if (!(err instanceof StorageNotFoundError)) {
        const msg = err instanceof Error ? err.message : String(err);
        return { ok: false, error: msg };
      }
      // Missing blob is the expected serverless case — fall through to the bundle.
    }
  }

  if (!templateDocxBuffer) {
    const bundled = await resolveBundledTerminationTemplate(chosenType);
    if (!bundled) {
      return {
        ok: false,
        error:
          "Nuk ka shabllon TERMINATION për këtë lloj largimi. Ngarkoni një DOCX te Dokumentet dhe caktoni \"terminationWorkflowKey\".",
      };
    }
    templateDocxBuffer = bundled.buffer;
  }

  let merged: Record<string, string>;
  try {
    const built = await buildMergedPlaceholderContext(prisma, {
      companyId,
      subjectKind: "TERMINATION",
      subjectId: term.id,
      documentDate: new Date(),
    });
    merged = built.merged;
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }

  let renderedBuffer: Buffer;
  try {
    const result = generateDocxFromTemplate({
      templateDocxBuffer,
      // The committed templates are PLACEHOLDER-mode; when a version row exists we
      // reuse its stored mapping so a storage render and a bundle render match.
      detectionMode: version?.detectionMode ?? "PLACEHOLDER",
      mappingJson: version?.mappingJson ?? null,
      detectedPlaceholders: null,
      underlineFieldOrder: version?.underlineFieldOrder ?? null,
      values: merged,
      placeholderRegistry: composePlaceholderRegistry(["TERMINATION"]),
    });
    renderedBuffer = result.buffer;
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }

  // Include the template key so downloading several templates for one employee
  // produces distinct files rather than overwriting each other.
  const filename = `Nderprerje_${asciiSlug(term.employee.lastName)}_${asciiSlug(
    term.employee.firstName,
  )}_${chosenType}.docx`;

  return { ok: true, buffer: renderedBuffer, filename, contentType: DOCX_CONTENT_TYPE };
}
