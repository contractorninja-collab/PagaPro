import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCompanyAssetStorage } from "@/lib/company-asset-storage";
import { resolveActiveCompanyId } from "@/server/company-scope";

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

  if (!artifact?.generatedDocxStorageKey) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const buf = await getCompanyAssetStorage().get(artifact.generatedDocxStorageKey);
    const base = artifact.displayFilename.replace(/\.[^.]+$/, "") || "document";
    const filename = `${base}.docx`;
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${encodeURIComponent(filename)}"`,
      },
    });
  } catch {
    return NextResponse.json({ error: "Failed to read file" }, { status: 500 });
  }
}
