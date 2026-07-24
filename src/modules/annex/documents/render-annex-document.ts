import Docxtemplater from "docxtemplater";
import PizZip from "pizzip";
import { prisma } from "@/lib/prisma";
import { buildMergedPlaceholderContext } from "@/modules/documents/services/build-placeholder-context";
import { resolveBundledAnnexTemplate } from "./bundled-annex-template";
import type { AnnexChange } from "@/modules/annex/types";
import { getCompanyAssetStorage } from "@/lib/company-asset-storage";
import { applyCompanyLogoToDocx } from "@/modules/company-branding/docx-logo-branding";
import { loadCompanyLogo } from "@/modules/company-branding/company-logo";

const DOCX_CONTENT_TYPE =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

function fmtDate(d: Date | null): string {
  if (!d) return "";
  return new Intl.DateTimeFormat("sq-AL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "Europe/Belgrade",
  }).format(d);
}

function asciiSlug(value: string): string {
  return (
    value
      .normalize("NFD")
      .replace(/[^A-Za-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "") || "x"
  );
}

export interface AnnexRenderData {
  flat: Record<string, string>;
  changes: AnnexChange[];
  employeeName: string;
  annexNumber: number;
}

/**
 * Builds the merged data object for one annex — company letterhead + parties
 * (reusing the CONTRACT context builder) plus the annex-specific keys and the
 * change list. Shared by the DOCX render and the print HTML view.
 */
export async function buildAnnexData(
  companyId: string,
  annexId: string,
): Promise<{ ok: true; data: AnnexRenderData } | { ok: false; error: string }> {
  const annex = await prisma.employeeContractAnnex.findFirst({
    where: { id: annexId, companyId },
  });
  if (!annex) return { ok: false, error: "Aneksi nuk u gjet." };

  const emp = await prisma.employee.findFirst({
    where: { id: annex.employeeId, companyId },
    select: { firstName: true, lastName: true, contractStartDate: true, hireDate: true },
  });
  if (!emp) return { ok: false, error: "Punonjësi nuk u gjet." };

  let merged: Record<string, string>;
  try {
    const built = await buildMergedPlaceholderContext(prisma, {
      companyId,
      subjectKind: "CONTRACT",
      subjectId: annex.employeeId,
      // Take the employee-driven path (build from live employee data), not the legacy Contract lookup.
      employeeId: annex.employeeId,
      documentDate: annex.effectiveDate,
    });
    merged = built.merged;
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }

  const changes = (annex.changesJson as unknown as AnnexChange[]) ?? [];

  const flat: Record<string, string> = {
    ...merged,
    annex_number: String(annex.annexNumber),
    original_contract_date: fmtDate(emp.contractStartDate ?? emp.hireDate),
    annex_effective_date: fmtDate(annex.effectiveDate),
  };

  return {
    ok: true,
    data: {
      flat,
      changes,
      employeeName: `${emp.firstName} ${emp.lastName}`.trim(),
      annexNumber: annex.annexNumber,
    },
  };
}

export type RenderAnnexResult =
  | { ok: true; buffer: Buffer; filename: string; contentType: string }
  | { ok: false; error: string };

/** Renders one annex to a DOCX buffer, in memory. Persists nothing. */
export async function renderAnnexDocument(
  companyId: string,
  annexId: string,
): Promise<RenderAnnexResult> {
  const built = await buildAnnexData(companyId, annexId);
  if (!built.ok) return built;

  let buffer: Buffer;
  try {
    const template = await resolveBundledAnnexTemplate();
    const zip = new PizZip(template);
    const doc = new Docxtemplater(zip, {
      paragraphLoop: true,
      linebreaks: true,
      delimiters: { start: "{{", end: "}}" },
      nullGetter() {
        return "";
      },
    });
    doc.render({ ...built.data.flat, changes: built.data.changes });
    const rendered = doc.getZip().generate({ type: "nodebuffer", compression: "DEFLATE" }) as Buffer;
    const companyLogo = await loadCompanyLogo(prisma, getCompanyAssetStorage(), companyId);
    buffer = applyCompanyLogoToDocx(rendered, companyLogo, {
      companyName: built.data.flat.company_name,
      documentReferencePrefix: built.data.flat.document_reference_prefix,
    });
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }

  const filename = `Aneks-${built.data.annexNumber}_${asciiSlug(built.data.employeeName)}.docx`;

  return { ok: true, buffer, filename, contentType: DOCX_CONTENT_TYPE };
}
