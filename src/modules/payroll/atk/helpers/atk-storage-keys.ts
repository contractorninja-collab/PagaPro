/** Stable storage keys for ATK XLSX blobs (same root convention as payroll PDFs). */

export function payrollAtkExportXlsxKey(params: {
  companyId: string;
  payrollId: string;
  exportId: string;
}): string {
  return `documents/payrolls/${params.companyId}/${params.payrollId}/atk/${params.exportId}.xlsx`;
}
