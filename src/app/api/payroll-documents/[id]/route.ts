import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCompanyAssetStorage } from "@/lib/company-asset-storage";
import { resolveActiveCompanyId } from "@/server/company-scope";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const companyId = await resolveActiveCompanyId();
  if (!companyId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const inline = new URL(request.url).searchParams.get("inline") === "1";

  const doc = await prisma.payrollGeneratedDocument.findFirst({
    where: { id, companyId },
  });

  if (!doc) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const buf = await getCompanyAssetStorage().get(doc.storageKey);
    const disposition = inline ? "inline" : "attachment";
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `${disposition}; filename="${encodeURIComponent(doc.filename)}"`,
      },
    });
  } catch {
    return NextResponse.json({ error: "Failed to read file" }, { status: 500 });
  }
}
