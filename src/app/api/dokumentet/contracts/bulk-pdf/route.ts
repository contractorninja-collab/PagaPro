import { NextResponse } from "next/server";
import PizZip from "pizzip";
import { prisma } from "@/lib/prisma";
import { getCompanyAssetStorage } from "@/lib/company-asset-storage";
import { companyContextHttpError, getCompanyContext } from "@/server/company-context";
import { ensureArtifactPdf } from "@/modules/documents/services/artifact-pdf-service";
import { mergePdfBuffers } from "@/modules/documents/services/bulk-pdf-service";

export async function POST(request: Request) {
  const result = await getCompanyContext();
  if (!result.ok) {
    return companyContextHttpError(result.reason);
  }
  const companyId = result.context.companyId;
  const inline = new URL(request.url).searchParams.get("inline") === "1";

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
  const artifactsById = new Map(artifacts.map((artifact) => [artifact.id, artifact]));
  const orderedArtifacts = artifactIds
    .map((id) => artifactsById.get(id))
    .filter((artifact): artifact is NonNullable<typeof artifact> => Boolean(artifact));

  const storage = getCompanyAssetStorage();

  if (inline) {
    if (orderedArtifacts.length !== artifactIds.length) {
      return NextResponse.json(
        { error: "Një ose më shumë dokumente nuk u gjetën." },
        { status: 404 },
      );
    }

    const pdfBuffers: Buffer[] = [];
    for (const artifact of orderedArtifacts) {
      const pdf = await ensureArtifactPdf(artifact, storage);
      if (!pdf.ok) {
        return NextResponse.json(
          {
            error:
              "Një ose më shumë dokumente nuk mund të përgatiten si PDF për parapamje.",
          },
          { status: 409 },
        );
      }
      pdfBuffers.push(pdf.buffer);
    }

    if (pdfBuffers.length === 0) {
      return NextResponse.json(
        { error: "Asnjë PDF i disponueshëm për parapamje." },
        { status: 404 },
      );
    }

    const mergedPdf = await mergePdfBuffers(pdfBuffers);
    return new NextResponse(new Uint8Array(mergedPdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition":
          'inline; filename="dokumentet-per-printim.pdf"',
        "Cache-Control": "private, no-store",
      },
    });
  }

  const zip = new PizZip();
  let added = 0;

  for (const artifact of orderedArtifacts) {
    const pdf = await ensureArtifactPdf(artifact, storage);
    if (pdf.ok) {
      const safeName = pdf.filename.replace(/[/\\?%*:|"<>]/g, "_");
      zip.file(safeName, pdf.buffer);
      added += 1;
      continue;
    }
    // DOCX-only mode (no PDF converter on this server): fall back to the stored
    // DOCX so the bulk download still delivers every document.
    if (artifact.generatedDocxStorageKey) {
      try {
        const buf = await storage.get(artifact.generatedDocxStorageKey);
        const base = artifact.displayFilename.replace(/\.[^.]+$/, "") || "dokument";
        const safeName = `${base}.docx`.replace(/[/\\?%*:|"<>]/g, "_");
        zip.file(safeName, buf);
        added += 1;
      } catch {
        // blob missing — skip, matching the existing per-artifact skip semantics
      }
    }
  }

  if (added === 0) {
    return NextResponse.json(
      { error: "Asnjë skedar i disponueshëm për dokumentet e zgjedhura." },
      { status: 404 },
    );
  }

  const zipBuffer = zip.generate({ type: "nodebuffer", compression: "DEFLATE" }) as Buffer;
  return new NextResponse(new Uint8Array(zipBuffer), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": 'attachment; filename="dokumentet.zip"',
    },
  });
}
