import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import PizZip from "pizzip";
import { prisma } from "@/lib/prisma";
import { getCompanyAssetStorage } from "@/lib/company-asset-storage";
import { resolveActiveCompanyId } from "@/server/company-scope";
import { generationArtifactPdfKey } from "@/modules/documents/engine";
import { convertDocxBufferToPdf } from "@/modules/documents/services/docx-to-pdf-service";

async function ensurePdfBuffer(
  artifact: {
    id: string;
    companyId: string;
    subjectKind: string;
    subjectId: string;
    generatedPdfStorageKey: string | null;
    generatedDocxStorageKey: string | null;
    displayFilename: string;
  },
  storage: ReturnType<typeof getCompanyAssetStorage>,
): Promise<{ buffer: Buffer; filename: string } | null> {
  if (artifact.generatedPdfStorageKey) {
    try {
      const buf = await storage.get(artifact.generatedPdfStorageKey);
      const filename = artifact.displayFilename.endsWith(".pdf")
        ? artifact.displayFilename
        : `${artifact.displayFilename.replace(/\.[^.]+$/, "")}.pdf`;
      return { buffer: buf, filename };
    } catch {
      return null;
    }
  }

  if (!artifact.generatedDocxStorageKey) return null;

  try {
    const docx = await storage.get(artifact.generatedDocxStorageKey);
    const conv = await convertDocxBufferToPdf(docx);
    if (!conv.ok) return null;

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

    const filename = artifact.displayFilename.endsWith(".pdf")
      ? artifact.displayFilename
      : `${artifact.displayFilename.replace(/\.[^.]+$/, "")}.pdf`;
    return { buffer: conv.pdf, filename };
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  const companyId = await resolveActiveCompanyId();
  if (!companyId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let artifactIds: string[] = [];
  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    const body = (await request.json()) as { artifactIds?: string[] };
    artifactIds = body.artifactIds ?? [];
  } else {
    const form = await request.formData();
    const raw = form.get("artifactIds");
    if (typeof raw === "string") {
      try {
        artifactIds = JSON.parse(raw) as string[];
      } catch {
        artifactIds = raw
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);
      }
    }
  }

  if (artifactIds.length === 0) {
    return NextResponse.json({ error: "artifactIds required" }, { status: 400 });
  }
  if (artifactIds.length > 200) {
    return NextResponse.json({ error: "Too many artifacts" }, { status: 400 });
  }

  const artifacts = await prisma.documentGenerationArtifact.findMany({
    where: { id: { in: artifactIds }, companyId },
  });

  const storage = getCompanyAssetStorage();
  const zip = new PizZip();
  let added = 0;

  for (const artifact of artifacts) {
    const pdf = await ensurePdfBuffer(artifact, storage);
    if (!pdf) continue;
    const safeName = pdf.filename.replace(/[/\\?%*:|"<>]/g, "_");
    zip.file(safeName, pdf.buffer);
    added += 1;
  }

  if (added === 0) {
    return NextResponse.json({ error: "No PDFs available for selected artifacts." }, { status: 404 });
  }

  const zipBuffer = zip.generate({ type: "nodebuffer", compression: "DEFLATE" }) as Buffer;
  return new NextResponse(new Uint8Array(zipBuffer), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": 'attachment; filename="dokumentet.zip"',
    },
  });
}
