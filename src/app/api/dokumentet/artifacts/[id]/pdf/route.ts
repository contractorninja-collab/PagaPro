import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCompanyAssetStorage } from "@/lib/company-asset-storage";
import { resolveActiveCompanyId } from "@/server/company-scope";
import { generationArtifactPdfKey } from "@/modules/documents/engine";
import { convertDocxBufferToPdf } from "@/modules/documents/services/docx-to-pdf-service";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const companyId = await resolveActiveCompanyId();
  if (!companyId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const url = new URL(request.url);
  const inline = url.searchParams.get("inline") === "1";

  const artifact = await prisma.documentGenerationArtifact.findFirst({
    where: { id, companyId },
  });

  if (!artifact) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const storage = getCompanyAssetStorage();
  let pdfBuffer: Buffer | null = null;

  if (artifact.generatedPdfStorageKey) {
    try {
      pdfBuffer = await storage.get(artifact.generatedPdfStorageKey);
    } catch {
      return NextResponse.json({ error: "Failed to read file" }, { status: 500 });
    }
  } else if (artifact.generatedDocxStorageKey) {
    // Lazy backfill: convert the immutable DOCX for artifacts generated before a
    // converter was available, persist the PDF, and attach its key to the row.
    // (Document content/snapshot stays untouched — only the derived PDF is added.)
    try {
      const docx = await storage.get(artifact.generatedDocxStorageKey);
      const conv = await convertDocxBufferToPdf(docx);
      if (!conv.ok) {
        return NextResponse.json(
          { error: "PDF not available (converter disabled or generation pending)." },
          { status: 404 },
        );
      }
      pdfBuffer = conv.pdf;

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
    } catch (err) {
      console.error("[pagapro] on-demand PDF conversion failed for artifact", id, err);
      return NextResponse.json({ error: "PDF conversion failed" }, { status: 500 });
    }
  }

  if (!pdfBuffer) {
    return NextResponse.json(
      { error: "PDF not available (converter disabled or generation pending)." },
      { status: 404 },
    );
  }

  const filename = artifact.displayFilename.endsWith(".pdf")
    ? artifact.displayFilename
    : `${artifact.displayFilename.replace(/\.[^.]+$/, "")}.pdf`;

  return new NextResponse(new Uint8Array(pdfBuffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${encodeURIComponent(filename)}"`,
    },
  });
}
