import { notFound } from "next/navigation";
import { TemplateMappingClient } from "@/modules/documents/components/template-mapping-client";
import {
  getDocumentTemplateDetail,
  listActivePlaceholderRegistry,
} from "@/modules/documents/services/document-queries";
import type { DetectedBlankField } from "@/modules/documents/types/template-mapping";
import { parseMappingJson } from "@/modules/documents/validators/document-template-validator";
import { resolveActiveCompanyId } from "@/server/company-scope";

export default async function TemplateMappingPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const companyId = await resolveActiveCompanyId();
  if (!companyId) notFound();

  const { id } = await params;
  const sp = await searchParams;
  const versionIdRaw = sp.versionId;
  const versionId = Array.isArray(versionIdRaw) ? versionIdRaw[0] : versionIdRaw;

  const [template, registry] = await Promise.all([
    getDocumentTemplateDetail(companyId, id),
    listActivePlaceholderRegistry(),
  ]);
  if (!template) notFound();

  const version =
    template.versions.find((v) => (versionId ? v.id === versionId : v.isPublished)) ??
    template.versions[0];
  if (!version) notFound();

  const detectedBlanks = (Array.isArray(version.detectedBlankFields)
    ? version.detectedBlankFields
    : []) as unknown as DetectedBlankField[];
  const detectedPlaceholders = Array.isArray(version.detectedPlaceholders)
    ? (version.detectedPlaceholders as string[])
    : [];

  return (
    <TemplateMappingClient
      templateId={template.id}
      templateName={template.name}
      versionId={version.id}
      versionNumber={version.versionNumber}
      detectionMode={version.detectionMode}
      detectedBlanks={detectedBlanks}
      detectedPlaceholders={detectedPlaceholders}
      initialMapping={parseMappingJson(version.mappingJson)}
      registry={registry.map((r) => ({
        placeholderKey: r.placeholderKey,
        label: r.label,
        category: r.category,
      }))}
    />
  );
}
