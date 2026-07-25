import { readFile } from "node:fs/promises";
import path from "node:path";
import { prisma } from "@/lib/prisma";
import { getCompanyAssetStorage } from "@/lib/company-asset-storage";
import { buildMergedPlaceholderContext } from "@/modules/documents/services/build-placeholder-context";
import { composePlaceholderRegistry } from "@/modules/documents/engine/placeholders/registry";
import { generateDocxFromTemplate } from "@/modules/documents/engine/generate-docx";
import { StorageNotFoundError } from "@/modules/documents/engine/storage/key-safety";
import { applyCompanyLogoToDocx } from "@/modules/company-branding/docx-logo-branding";
import { loadCompanyLogo } from "@/modules/company-branding/company-logo";

const DOCX_CONTENT_TYPE =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

interface ManifestEntry {
  filename: string;
  name: string;
  measure: string | null;
}

/** Template name per measure (neni 85.1); a warning with no measure prints the general notice. */
function templateNameForMeasure(measure: string | null): string {
  if (measure === "VERBALE") return "Vërejtje me gojë";
  if (measure === "ME_SHKRIM") return "Vërejtje me shkrim";
  return "Vërejtje";
}

function templatesDir(): string {
  return path.join(process.cwd(), "templates", "warning");
}

/**
 * The committed DOCX for a template name — the fallback used when the seeded blob
 * is missing, which is the normal state on a deployment with no object store.
 */
async function resolveBundledWarningTemplate(name: string): Promise<Buffer | null> {
  try {
    const raw = await readFile(path.join(templatesDir(), "manifest.json"), "utf8");
    const parsed = JSON.parse(raw) as { templates?: ManifestEntry[] };
    const entry = (parsed.templates ?? []).find((e) => e.name === name);
    if (!entry) return null;
    return await readFile(path.join(templatesDir(), entry.filename));
  } catch {
    return null;
  }
}

function asciiSlug(value: string): string {
  return (
    value
      .normalize("NFD")
      .replace(/[^A-Za-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "") || "x"
  );
}

export type RenderWarningResult =
  | { ok: true; buffer: Buffer; filename: string; contentType: string }
  | { ok: false; error: string };

/**
 * Renders one disciplinary warning to a DOCX, in memory, persisting nothing.
 *
 * The template follows the measure recorded on the warning, so a verbal measure
 * prints the neni 85.1.1 notice and a written one the neni 85.1.2 notice.
 * `templateName` overrides that when the caller wants a specific document.
 */
export async function renderWarningDocument(
  companyId: string,
  warningId: string,
  templateName?: string,
): Promise<RenderWarningResult> {
  const warning = await prisma.disciplinaryWarning.findFirst({
    where: { id: warningId, companyId },
    include: { employee: { select: { firstName: true, lastName: true } } },
  });
  if (!warning) return { ok: false, error: "Vërejtja nuk u gjet." };

  const chosenName = templateName ?? templateNameForMeasure(warning.measure);

  const template = await prisma.documentTemplate.findFirst({
    where: { companyId, documentCategory: "WARNING", name: chosenName, isActive: true },
    include: {
      versions: {
        where: { isPublished: true },
        orderBy: { versionNumber: "desc" },
        take: 1,
      },
    },
  });

  let templateDocxBuffer: Buffer | null = null;
  const version = template?.versions[0] ?? null;
  if (version) {
    try {
      templateDocxBuffer = await getCompanyAssetStorage().get(version.sourceStorageKey);
    } catch (err) {
      if (!(err instanceof StorageNotFoundError)) {
        return { ok: false, error: err instanceof Error ? err.message : String(err) };
      }
      // Missing blob is the expected serverless case — fall through to the bundle.
    }
  }

  if (!templateDocxBuffer) {
    templateDocxBuffer = await resolveBundledWarningTemplate(chosenName);
    if (!templateDocxBuffer) {
      return {
        ok: false,
        error: `Nuk ka shabllon "${chosenName}". Ekzekutoni seed-in e shablloneve ose ngarkoni një DOCX te Dokumentet.`,
      };
    }
  }

  let merged: Record<string, string>;
  try {
    const built = await buildMergedPlaceholderContext(prisma, {
      companyId,
      subjectKind: "WARNING",
      subjectId: warning.id,
      documentDate: new Date(),
    });
    merged = built.merged;
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }

  let buffer: Buffer;
  try {
    const result = generateDocxFromTemplate({
      templateDocxBuffer,
      detectionMode: version?.detectionMode ?? "PLACEHOLDER",
      mappingJson: version?.mappingJson ?? null,
      detectedPlaceholders: null,
      underlineFieldOrder: version?.underlineFieldOrder ?? null,
      values: merged,
      placeholderRegistry: composePlaceholderRegistry(["WARNING"]),
    });
    const storage = getCompanyAssetStorage();
    const logo = await loadCompanyLogo(prisma, storage, companyId);
    buffer = applyCompanyLogoToDocx(result.buffer, logo);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }

  const filename = `${asciiSlug(chosenName)}_${asciiSlug(warning.employee.lastName)}_${asciiSlug(
    warning.employee.firstName,
  )}.docx`;

  return { ok: true, buffer, filename, contentType: DOCX_CONTENT_TYPE };
}
