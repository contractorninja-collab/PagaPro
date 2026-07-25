import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCompanyAssetStorage } from "@/lib/company-asset-storage";
import { companyContextErrorMessage, getCompanyContext } from "@/server/company-context";
import { renderAnnexDocument } from "@/modules/annex/documents/render-annex-document";
import { renderWarningDocument } from "@/modules/warnings/documents/render-warning-document";
import { renderDocxToPrintHtml } from "@/modules/documents/print/docx-to-print-html";
import {
  buildPrintErrorPage,
  buildPrintPageHtml,
  type PrintablePageDocument,
} from "@/modules/documents/print/build-print-page";

const MAX_DOCUMENTS = 100;

function htmlResponse(html: string, status = 200): NextResponse {
  return new NextResponse(html, {
    status,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

/**
 * Print view for one or more generated documents: `?ids=a,b,c`.
 *
 * Opened in a new tab, it renders every document on its own sheet and triggers the
 * browser's print dialog, which is how a batch of contracts gets previewed and
 * printed on a deployment with no DOCX→PDF converter.
 */
export async function GET(request: Request) {
  const context = await getCompanyContext();
  if (!context.ok) {
    return htmlResponse(buildPrintErrorPage(companyContextErrorMessage(context.reason)), 403);
  }
  const { companyId } = context.context;

  const params = new URL(request.url).searchParams;
  const idList = (value: string | null) =>
    (value ?? "")
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean);

  const requestedIds = idList(params.get("ids"));
  // Annexes are rendered on demand rather than stored as artifacts, so they come
  // in under their own parameter and are appended after the stored documents.
  const requestedAnnexIds = idList(params.get("annexIds"));
  const requestedWarningIds = idList(params.get("warningIds"));
  const totalRequested =
    requestedIds.length + requestedAnnexIds.length + requestedWarningIds.length;

  if (totalRequested === 0) {
    return htmlResponse(buildPrintErrorPage("Nuk u specifikua asnjë dokument për printim."), 400);
  }
  if (totalRequested > MAX_DOCUMENTS) {
    return htmlResponse(
      buildPrintErrorPage(`Printimi mbështet deri në ${MAX_DOCUMENTS} dokumente njëherësh.`),
      400,
    );
  }

  const artifacts = await prisma.documentGenerationArtifact.findMany({
    where: { id: { in: requestedIds }, companyId },
    select: { id: true, title: true, displayFilename: true, generatedDocxStorageKey: true },
  });

  const byId = new Map(artifacts.map((artifact) => [artifact.id, artifact]));
  const storage = getCompanyAssetStorage();
  const documents: PrintablePageDocument[] = [];
  const skipped: string[] = [];

  // Keep the caller's order so the printed batch matches the on-screen list.
  for (const id of requestedIds) {
    const artifact = byId.get(id);
    if (!artifact?.generatedDocxStorageKey) {
      skipped.push(artifact?.displayFilename ?? id);
      continue;
    }
    try {
      const docx = await storage.get(artifact.generatedDocxStorageKey);
      documents.push({
        title: artifact.displayFilename.replace(/\.[^.]+$/, "") || artifact.title,
        render: renderDocxToPrintHtml(docx),
      });
    } catch (error) {
      console.error("[pagapro] print view could not render artifact", id, error);
      skipped.push(artifact.displayFilename || artifact.title);
    }
  }

  for (const annexId of requestedAnnexIds) {
    const rendered = await renderAnnexDocument(companyId, annexId);
    if (!rendered.ok) {
      console.error("[pagapro] print view could not render annex", annexId, rendered.error);
      skipped.push(annexId);
      continue;
    }
    documents.push({
      title: rendered.filename.replace(/\.[^.]+$/, ""),
      render: renderDocxToPrintHtml(rendered.buffer),
    });
  }

  for (const warningId of requestedWarningIds) {
    const rendered = await renderWarningDocument(companyId, warningId);
    if (!rendered.ok) {
      console.error("[pagapro] print view could not render warning", warningId, rendered.error);
      skipped.push(warningId);
      continue;
    }
    documents.push({
      title: rendered.filename.replace(/\.[^.]+$/, ""),
      render: renderDocxToPrintHtml(rendered.buffer),
    });
  }

  if (documents.length === 0) {
    return htmlResponse(
      buildPrintErrorPage("Asnjë nga dokumentet e zgjedhura nuk mund të lexohej për printim."),
      404,
    );
  }
  if (skipped.length > 0) {
    console.warn(`[pagapro] print view skipped ${skipped.length} document(s): ${skipped.join(", ")}`);
  }

  return htmlResponse(buildPrintPageHtml(documents));
}
