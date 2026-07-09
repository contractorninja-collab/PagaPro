import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCompanyAssetStorage } from "@/lib/company-asset-storage";
import { companyContextHttpError, getCompanyContext } from "@/server/company-context";
import { ensureArtifactPdf } from "@/modules/documents/services/artifact-pdf-service";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const result = await getCompanyContext();
  if (!result.ok) {
    return companyContextHttpError(result.reason);
  }
  const companyId = result.context.companyId;

  const { id } = await context.params;
  const url = new URL(request.url);
  const inline = url.searchParams.get("inline") === "1";

  const artifact = await prisma.documentGenerationArtifact.findFirst({
    where: { id, companyId },
  });

  if (!artifact) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const pdf = await ensureArtifactPdf(artifact, getCompanyAssetStorage());
  if (!pdf.ok) {
    if (pdf.reason === "ERROR") {
      return NextResponse.json({ error: "PDF conversion failed" }, { status: 500 });
    }
    return NextResponse.json(
      { error: "PDF not available (converter disabled or generation pending)." },
      { status: 404 },
    );
  }

  return new NextResponse(new Uint8Array(pdf.buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${encodeURIComponent(pdf.filename)}"`,
    },
  });
}
