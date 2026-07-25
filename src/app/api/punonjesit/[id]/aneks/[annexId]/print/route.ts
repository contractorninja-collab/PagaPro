import { NextResponse } from "next/server";
import { companyContextErrorMessage, getCompanyContext } from "@/server/company-context";
import { renderAnnexDocument } from "@/modules/annex/documents/render-annex-document";
import { renderDocxToPrintHtml } from "@/modules/documents/print/docx-to-print-html";
import { buildPrintErrorPage, buildPrintPageHtml } from "@/modules/documents/print/build-print-page";

export const runtime = "nodejs";

function htmlResponse(html: string, status = 200): NextResponse {
  return new NextResponse(html, {
    status,
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
  });
}

/**
 * Print view for one annex, rendered from the same DOCX the download produces.
 *
 * The annex used to print from a hand-written React page inside the dashboard
 * layout, which put the app's navigation on the paper and drifted from the
 * template's own wording, fonts and logo. Rendering the DOCX keeps the printed
 * annex identical to the downloaded one.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string; annexId: string }> },
) {
  const ctx = await getCompanyContext();
  if (!ctx.ok) {
    return htmlResponse(buildPrintErrorPage(companyContextErrorMessage(ctx.reason)), 403);
  }
  const { companyId } = ctx.context;
  const { annexId } = await params;

  const rendered = await renderAnnexDocument(companyId, annexId);
  if (!rendered.ok) {
    return htmlResponse(buildPrintErrorPage(rendered.error), 404);
  }

  const title = rendered.filename.replace(/\.[^.]+$/, "");
  return htmlResponse(
    buildPrintPageHtml([{ title, render: renderDocxToPrintHtml(rendered.buffer) }]),
  );
}
