import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCompanyAssetStorage } from "@/lib/company-asset-storage";
import { resolveActiveCompanyId, assertCompanyScopedStorageKey } from "@/server/company-scope";
import { appendReportExportLog } from "@/modules/reports/services/report-log-service";

function dispositionFilename(reportTitle: string, format: string): string {
  const safe = reportTitle.replace(/[^\w\s\-ëçÇË]/g, "").replace(/\s+/g, "_").slice(0, 80);
  const ext = format.toLowerCase();
  return `${safe || "raport"}.${ext}`;
}

function mimeFor(format: string): string {
  switch (format) {
    case "XLSX":
      return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    case "PDF":
      return "application/pdf";
    case "CSV":
      return "text/csv; charset=utf-8";
    default:
      return "application/octet-stream";
  }
}

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const companyId = await resolveActiveCompanyId();
  if (!companyId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;

  const doc = await prisma.generatedReport.findFirst({
    where: { id, companyId },
  });

  if (!doc) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    assertCompanyScopedStorageKey(companyId, doc.storageKey);
    const buf = await getCompanyAssetStorage().get(doc.storageKey);

    await appendReportExportLog({
      companyId,
      generatedReportId: doc.id,
      action: "DOWNLOADED",
      performedByUserId: null,
      metadataJson: { format: doc.fileFormat },
    });

    const fname = dispositionFilename(doc.title, doc.fileFormat === "XLSX" ? "xlsx" : doc.fileFormat.toLowerCase());

    return new NextResponse(new Uint8Array(buf), {
      headers: {
        "Content-Type": mimeFor(doc.fileFormat),
        "Content-Disposition": `attachment; filename="${encodeURIComponent(fname)}"`,
      },
    });
  } catch {
    return NextResponse.json({ error: "Failed to read file" }, { status: 500 });
  }
}
