import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { RaportetDetailClient } from "@/modules/reports/components/raportet-detail-client";
import { previewReportInput } from "@/modules/reports/services/report-generation-service";
import { getGeneratedReportDetail } from "@/modules/reports/services/report-query-service";
import { categoryForReportType, REPORT_CATEGORY_LABEL_SQ } from "@/modules/reports/types";
import { requireCompanyContextPage } from "@/server/company-context";

export const metadata: Metadata = {
  title: "Detaji raportit",
};

export default async function RaportetDetailPage(props: { params: Promise<{ id: string }> }) {
  const { companyId } = await requireCompanyContextPage();

  const { id } = await props.params;

  const row = await getGeneratedReportDetail(companyId, id);
  if (!row) notFound();

  let preview;
  try {
    preview = await previewReportInput({
      companyId,
      reportType: row.reportType,
      filtersRaw: row.filtersJson,
    });
  } catch {
    preview = { columns: [] as { key: string; headerSq: string }[], rows: [], truncated: false };
  }

  const cat = categoryForReportType(row.reportType);

  const logs = row.exportLogs.map((l) => ({
    id: l.id,
    action: l.action,
    performedAt: l.performedAt.toISOString(),
    performer: l.performedBy?.displayName ?? l.performedBy?.email ?? null,
  }));

  return (
    <RaportetDetailClient
      id={row.id}
      title={row.title}
      reportType={row.reportType}
      categoryLabel={REPORT_CATEGORY_LABEL_SQ[cat]}
      fileFormat={row.fileFormat}
      generatedAt={row.generatedAt.toISOString()}
      isArchived={row.isArchived}
      filtersJson={row.filtersJson}
      generatedByDisplay={row.generatedBy?.displayName ?? row.generatedBy?.email ?? null}
      previewColumns={preview.columns}
      previewRows={preview.rows as Record<string, unknown>[]}
      previewTruncated={preview.truncated}
      logs={logs}
    />
  );
}
