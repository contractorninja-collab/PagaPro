import { NextResponse } from "next/server";
import { getCompanyContext, companyContextHttpError } from "@/server/company-context";
import { renderTerminationDocument } from "@/modules/terminations/documents/render-termination-document";

export const runtime = "nodejs";

/**
 * Streams a termination's decision document as a DOCX, rendered in-request.
 *
 * Persists nothing: the template comes from storage when seeded and otherwise
 * from the repo's bundled DOCX, and the rendered file streams straight back.
 * This is what makes "Shkarko" work on a serverless deployment without an object
 * store. `?inline=1` previews in the browser; otherwise it downloads.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getCompanyContext();
  if (!ctx.ok) return companyContextHttpError(ctx.reason);
  const { companyId } = ctx.context;

  const { id } = await params;
  const inline = new URL(request.url).searchParams.get("inline") === "1";

  const result = await renderTerminationDocument(companyId, id);
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
