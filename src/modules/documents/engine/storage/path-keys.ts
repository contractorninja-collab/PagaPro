/**
 * Storage key helpers — keep opaque keys stable for S3/local swapping.
 * Prefix roots come from env (e.g. DOCUMENT_STORAGE_ROOT) in the storage adapter.
 */

export function templateVersionSourceKey(params: {
  companyId: string;
  templateId: string;
  versionNumber: number;
  /** Optional suffix if multiple blobs per version (rare) */
  suffix?: string;
}): string {
  const sfx = params.suffix ? `_${params.suffix}` : "";
  return `documents/templates/${params.companyId}/${params.templateId}/v${params.versionNumber}/source${sfx}.docx`;
}

export function generationArtifactDocxKey(params: {
  companyId: string;
  subjectKind: string;
  subjectId: string;
  artifactId: string;
}): string {
  return `documents/artifacts/${params.companyId}/${params.subjectKind}/${params.subjectId}/${params.artifactId}/render.docx`;
}

export function generationArtifactPdfKey(params: {
  companyId: string;
  subjectKind: string;
  subjectId: string;
  artifactId: string;
}): string {
  return `documents/artifacts/${params.companyId}/${params.subjectKind}/${params.subjectId}/${params.artifactId}/final.pdf`;
}
