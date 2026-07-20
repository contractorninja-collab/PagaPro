import { NextResponse } from "next/server";
import { getCompanyContext, companyContextHttpError } from "@/server/company-context";
import { renderAnnexDocument } from "@/modules/annex/documents/render-annex-document";

export const runtime = "nodejs";

/**
 * Streams a contract annex as a DOCX, rendered in-request from the committed
 * template. Persists nothing and needs no object store. `?inline=1` previews.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string; annexId: string }> },
) {
  const ctx = await getCompanyContext();
  if (!ctx.ok) return companyContextHttpError(ctx.reason);
  const { companyId } = ctx.context;

  const { annexId } = await params;
  const inline = new URL(request.url).searchParams.get("inline") === "1";

  const result = await renderAnnexDocument(companyId, annexId);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 404 });
  }

  return new NextResponse(new Uint8Array(result.buffer), {
    headers: {
      "Content-Type": result.contentType,
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${encodeURIComponent(result.filename)}"`,
    },
  });
}
