/** Stable keys for payroll PDF artifacts under the document storage root. */

export function payrollDocumentPdfKey(params: {
  companyId: string;
  payrollId: string;
  documentId: string;
  suffix: "register_totals" | "register_signatures" | "payslip" | "payslips_bundle";
}): string {
  return `documents/payrolls/${params.companyId}/${params.payrollId}/${params.documentId}_${params.suffix}.pdf`;
}
