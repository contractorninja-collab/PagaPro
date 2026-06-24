import type { LeaveRequestStatus } from "@prisma/client";

export function payrollImpactLabel(row: {
  status: LeaveRequestStatus;
  affectsPayroll: boolean;
  isPaid: boolean;
}): string {
  if (row.status === "CANCELLED" || row.status === "REJECTED" || row.status === "DRAFT") {
    return "—";
  }
  if (!row.affectsPayroll) return "Pa ndikim në payroll";
  if (!row.isPaid) return "Pa pagesë → zbritje";
  return "I paguar → orë në payroll";
}
