import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DocumentDetailClient } from "@/modules/documents/components/document-detail-client";
import { getDocumentArtifactDetail } from "@/modules/documents/services/document-queries";
import { getCompanyContext, requireCompanyContextPage } from "@/server/company-context";

type Props = { params: Promise<{ id: string }> };

function jsonToPayloadRecord(value: unknown): Record<string, string> {
  if (value == null || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    out[k] = v === undefined || v === null ? "" : String(v);
  }
  return out;
}

function toDetectedKeys(value: unknown): string[] {
  if (value == null || !Array.isArray(value)) return [];
  return value.filter((x): x is string => typeof x === "string");
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  try {
    const { id } = await params;
    const result = await getCompanyContext();
    if (!result.ok) return { title: "Dokumenti" };
    const a = await getDocumentArtifactDetail(result.context.companyId, id);
    if (!a) return { title: "Dokumenti" };
    return { title: a.title };
  } catch {
    return { title: "Dokumenti" };
  }
}

export default async function DokumentDetailPage({ params }: Props) {
  const { id } = await params;
  const { companyId } = await requireCompanyContextPage();

  let a;
  try {
    a = await getDocumentArtifactDetail(companyId, id);
  } catch (err) {
    console.error("[pagapro] DokumentDetailPage failed", err);
    return (
      <div className="mx-auto max-w-xl py-12">
        <p className="text-sm text-destructive">Nuk mund të lexohet dokumenti.</p>
      </div>
    );
  }

  if (!a) notFound();

  const mergedPayload = jsonToPayloadRecord(a.mergedPayload);
  const detectedKeys = toDetectedKeys(a.detectedPlaceholderKeys);

  const artifact = {
    id: a.id,
    title: a.title,
    displayFilename: a.displayFilename,
    documentCategory: a.documentCategory,
    kind: a.kind,
    createdAt: a.createdAt.toISOString(),
    createdAtLabel: a.createdAt.toLocaleString("sq-AL", { dateStyle: "medium", timeStyle: "short" }),
    isArchived: a.isArchived,
    mergedPayload,
    detectedKeys,
    hasPdf: Boolean(a.generatedPdfStorageKey),
    hasDocx: Boolean(a.generatedDocxStorageKey),
    generationError: a.generationError ?? null,
    templateName: a.templateVersion.template.name,
    templateVersion: a.templateVersion.versionNumber,
    employeeLabel: a.employee
      ? `${a.employee.firstName} ${a.employee.lastName}`.trim()
      : null,
    payrollLabel: a.payroll
      ? `${a.payroll.year}-${String(a.payroll.month).padStart(2, "0")}`
      : null,
  };

  return <DocumentDetailClient artifact={artifact} />;
}
