import { NextResponse } from "next/server";
import PizZip from "pizzip";
import { prisma } from "@/lib/prisma";
import { getCompanyAssetStorage } from "@/lib/company-asset-storage";
import { companyContextHttpError, getCompanyContext } from "@/server/company-context";
import { ensureArtifactPdf } from "@/modules/documents/services/artifact-pdf-service";

export async function POST(request: Request) {
  const result = await getCompanyContext();
  if (!result.ok) {
    return companyContextHttpError(result.reason);
  }
  const companyId = result.context.companyId;

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
    const pdf = await ensureArtifactPdf(artifact, storage);
    if (!pdf.ok) continue;
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
