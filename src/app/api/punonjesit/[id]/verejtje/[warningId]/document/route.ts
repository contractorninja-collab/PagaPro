import { NextResponse } from "next/server";
import { companyContextHttpError, getCompanyContext } from "@/server/company-context";
import { renderWarningDocument } from "@/modules/warnings/documents/render-warning-document";

export const runtime = "nodejs";

/** Streams a disciplinary warning as a DOCX, rendered in-request. Persists nothing. */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string; warningId: string }> },
) {
  const ctx = await getCompanyContext();
  if (!ctx.ok) return companyContextHttpError(ctx.reason);

  const { warningId } = await params;
  const url = new URL(request.url);
  const inline = url.searchParams.get("inline") === "1";
  const templateName = url.searchParams.get("template") ?? undefined;

  const result = await renderWarningDocument(ctx.context.companyId, warningId, templateName);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 404 });

  return new NextResponse(new Uint8Array(result.buffer), {
    headers: {
      "Content-Type": result.contentType,
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${encodeURIComponent(result.filename)}"`,
    },
  });
}
