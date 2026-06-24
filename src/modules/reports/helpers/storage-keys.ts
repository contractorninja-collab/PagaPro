export type ReportFileExt = "xlsx" | "pdf" | "csv";

export function generatedReportStorageKey(params: {
  companyId: string;
  reportId: string;
  ext: ReportFileExt;
}): string {
  return `companies/${params.companyId}/reports/${params.reportId}/report.${params.ext}`;
}
