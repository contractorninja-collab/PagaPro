import { NextResponse } from "next/server";
import { companyContextErrorMessage, getCompanyContext } from "@/server/company-context";
import { renderWarningDocument } from "@/modules/warnings/documents/render-warning-document";
import { renderDocxToPrintHtml } from "@/modules/documents/print/docx-to-print-html";
import { buildPrintErrorPage, buildPrintPageHtml } from "@/modules/documents/print/build-print-page";

export const runtime = "nodejs";

function htmlResponse(html: string, status = 200): NextResponse {
  return new NextResponse(html, {
    status,
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
  });
}

/** Print view for one warning, rendered from the same DOCX the download produces. */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string; warningId: string }> },
) {
  const ctx = await getCompanyContext();
  if (!ctx.ok) {
    return htmlResponse(buildPrintErrorPage(companyContextErrorMessage(ctx.reason)), 403);
  }

  const { warningId } = await params;
  const templateName = new URL(request.url).searchParams.get("template") ?? undefined;

  const rendered = await renderWarningDocument(ctx.context.companyId, warningId, templateName);
  if (!rendered.ok) return htmlResponse(buildPrintErrorPage(rendered.error), 404);

  return htmlResponse(
    buildPrintPageHtml([
      {
        title: rendered.filename.replace(/\.[^.]+$/, ""),
        render: renderDocxToPrintHtml(rendered.buffer),
      },
    ]),
  );
}
