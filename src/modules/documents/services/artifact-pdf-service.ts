import { createHash } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { generationArtifactPdfKey } from "@/modules/documents/engine";
import { convertDocxBufferToPdf } from "@/modules/documents/services/docx-to-pdf-service";
import type { DocumentStorage } from "@/modules/documents/engine/storage/types";

/** Minimal artifact shape the PDF resolver needs (works for both single + bulk download). */
export interface ArtifactPdfSource {
  id: string;
  companyId: string;
  subjectKind: string;
  subjectId: string;
  generatedPdfStorageKey: string | null;
  generatedDocxStorageKey: string | null;
  displayFilename: string;
}

export type EnsureArtifactPdfResult =
  | { ok: true; buffer: Buffer; filename: string }
  | { ok: false; reason: "NO_SOURCE" | "CONVERTER_UNAVAILABLE" | "ERROR" };

function pdfFilename(displayFilename: string): string {
  return displayFilename.endsWith(".pdf")
    ? displayFilename
    : `${displayFilename.replace(/\.[^.]+$/, "")}.pdf`;
}

/**
 * Resolve an artifact's PDF: serve the stored blob, or lazily backfill by converting
 * the immutable DOCX, persisting the PDF, and attaching its key to the row (content
 * snapshot untouched — only the derived PDF is added). Shared by the single-artifact
 * and bulk-zip download routes so the backfill logic lives in exactly one place.
 */
export async function ensureArtifactPdf(
  artifact: ArtifactPdfSource,
  storage: DocumentStorage,
): Promise<EnsureArtifactPdfResult> {
  const filename = pdfFilename(artifact.displayFilename);

  if (artifact.generatedPdfStorageKey) {
    try {
      const buffer = await storage.get(artifact.generatedPdfStorageKey);
      return { ok: true, buffer, filename };
    } catch {
      return { ok: false, reason: "ERROR" };
    }
  }

  if (!artifact.generatedDocxStorageKey) return { ok: false, reason: "NO_SOURCE" };

  try {
    const docx = await storage.get(artifact.generatedDocxStorageKey);
    const conv = await convertDocxBufferToPdf(docx);
    if (!conv.ok) return { ok: false, reason: "CONVERTER_UNAVAILABLE" };

    const pdfStorageKey = generationArtifactPdfKey({
      companyId: artifact.companyId,
      subjectKind: artifact.subjectKind,
      subjectId: artifact.subjectId,
      artifactId: artifact.id,
    });
    await storage.put(pdfStorageKey, conv.pdf, { contentType: "application/pdf" });
    await prisma.documentGenerationArtifact.update({
      where: { id: artifact.id },
      data: {
        generatedPdfStorageKey: pdfStorageKey,
        pdfSha256: createHash("sha256").update(conv.pdf).digest("hex"),
      },
    });
    return { ok: true, buffer: conv.pdf, filename };
  } catch (err) {
    console.error("[pagapro] artifact PDF backfill failed", artifact.id, err);
    return { ok: false, reason: "ERROR" };
  }
}
