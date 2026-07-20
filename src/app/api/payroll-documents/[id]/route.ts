import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCompanyAssetStorage } from "@/lib/company-asset-storage";
import { companyContextHttpError, getCompanyContext } from "@/server/company-context";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const result = await getCompanyContext();
  if (!result.ok) {
    return companyContextHttpError(result.reason);
  }
  const { companyId } = result.context;

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
