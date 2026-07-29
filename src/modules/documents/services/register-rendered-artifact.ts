import { createHash, randomUUID } from "node:crypto";
import type { DocumentCategory, DocumentSubjectKind, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCompanyAssetStorage } from "@/lib/company-asset-storage";
import { generationArtifactDocxKey } from "@/modules/documents/engine/storage/path-keys";

/**
 * Files an already-rendered document into the Dokumentet register.
 *
 * `finalizeDocumentGeneration` does the rendering itself from a merged
 * placeholder context, which suits the generator. Annexes and terminations
 * render their own way — an annex feeds docxtemplater a `changes` array the
 * generic path knows nothing about — so they need a way to hand over a finished
 * buffer and have it recorded. Without this they produced files that existed
 * nowhere: not searchable, not auditable, not in the register.
 *
 * Idempotent on `(subjectKind, subjectId, documentTemplateId)` — the document's
 * natural key. One annex is one document; a termination can be printed under
 * several letter types, and the template tells them apart. Downloading the same
 * one twice must not leave two rows behind.
 */
export interface RegisterRenderedArtifactParams {
  companyId: string;
  documentTemplateId: string;
  templateVersionId: string;
  subjectKind: DocumentSubjectKind;
  subjectId: string;
  documentCategory: DocumentCategory;
  title: string;
  displayFilename: string;
  buffer: Buffer;
  employeeId?: string | null;
  createdByUserId?: string | null;
  /** Recorded on the artifact so the register can show what fed the render. */
  mergedPayload?: Record<string, unknown>;
}

export interface RegisterRenderedArtifactResult {
  artifactId: string;
  created: boolean;
}

export async function registerRenderedArtifact(
  params: RegisterRenderedArtifactParams,
): Promise<RegisterRenderedArtifactResult> {
  const existing = await prisma.documentGenerationArtifact.findFirst({
    where: {
      companyId: params.companyId,
      subjectKind: params.subjectKind,
      subjectId: params.subjectId,
      documentTemplateId: params.documentTemplateId,
    },
    select: { id: true },
  });
  if (existing) return { artifactId: existing.id, created: false };

  const artifactId = randomUUID();
  const docxStorageKey = generationArtifactDocxKey({
    companyId: params.companyId,
    subjectKind: params.subjectKind,
    subjectId: params.subjectId,
    artifactId,
  });

  await getCompanyAssetStorage().put(docxStorageKey, params.buffer, {
    contentType:
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  });

  await prisma.documentGenerationArtifact.create({
    data: {
      id: artifactId,
      companyId: params.companyId,
      employeeId: params.employeeId ?? undefined,
      documentTemplateId: params.documentTemplateId,
      templateVersionId: params.templateVersionId,
      subjectKind: params.subjectKind,
      subjectId: params.subjectId,
      documentCategory: params.documentCategory,
      kind: "ARCHIVED_FINAL",
      title: params.title,
      displayFilename: params.displayFilename,
      mergedPayload: (params.mergedPayload ?? {}) as Prisma.InputJsonValue,
      detectedPlaceholderKeys: [] as unknown as Prisma.InputJsonValue,
      snapshotSchemaVersion: "v1",
      generatedDocxStorageKey: docxStorageKey,
      docxSha256: createHash("sha256").update(params.buffer).digest("hex"),
      generationStatus: "SUCCEEDED",
      createdByUserId: params.createdByUserId ?? undefined,
    },
  });

  return { artifactId, created: true };
}
