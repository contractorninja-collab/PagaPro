import { NextResponse } from "next/server";
import { companyContextHttpError, getCompanyContext } from "@/server/company-context";
import { listLeaveRequestsForExport } from "@/modules/leaves/services/leave-query-service";
import { parseLeaveListParams } from "@/modules/leaves/helpers/leave-list-params";
import {
  LEAVE_SUBTYPE_LABELS_SQ,
  LEAVE_TYPE_LABELS_SQ,
} from "@/modules/leaves/helpers/leave-type-metadata";
import { LEAVE_STATUS_LABELS_SQ } from "@/modules/leaves/helpers/leave-status-labels";
import { rowsToCsvBuffer } from "@/modules/reports/exporters/csv-export";
import type { ReportColumnDef, ReportRow } from "@/modules/reports/types";

const COLUMNS: ReportColumnDef[] = [
  { key: "employeeName", headerSq: "Punonjësi" },
  { key: "departmentName", headerSq: "Departamenti" },
  { key: "type", headerSq: "Lloji" },
  { key: "subtype", headerSq: "Nën-lloji" },
  { key: "status", headerSq: "Statusi" },
  { key: "startDate", headerSq: "Fillimi" },
  { key: "endDate", headerSq: "Mbarimi" },
  { key: "totalDays", headerSq: "Ditë kalendarike" },
  { key: "workingDays", headerSq: "Ditë pune" },
  { key: "totalHours", headerSq: "Orë" },
  { key: "isPaid", headerSq: "Me pagesë" },
  { key: "affectsPayroll", headerSq: "Ndikon në payroll" },
  { key: "reason", headerSq: "Arsyeja" },
  { key: "rejectionReason", headerSq: "Arsyeja e refuzimit" },
  { key: "balanceOverrideApprovedBy", headerSq: "Aprovoi tejkalimin e bilancit" },
  { key: "createdAt", headerSq: "Krijuar më" },
  { key: "decidedAt", headerSq: "Vendosur më" },
  { key: "decidedBy", headerSq: "Vendosur nga" },
  { key: "documentCount", headerSq: "Dokumente" },
];

/** YYYY-MM-DD sorts correctly in a spreadsheet; a localised date does not. */
const isoDay = (d: Date | null | undefined): string => (d ? d.toISOString().slice(0, 10) : "");

const yesNo = (v: boolean): string => (v ? "Po" : "Jo");

export async function GET(request: Request) {
  const result = await getCompanyContext();
  if (!result.ok) return companyContextHttpError(result.reason);
  const { companyId } = result.context;

  const url = new URL(request.url);
  const { filters, year, month, allMonths } = parseLeaveListParams(
    Object.fromEntries(url.searchParams),
  );

  const { rows, truncated } = await listLeaveRequestsForExport(companyId, filters);

  const csvRows: ReportRow[] = rows.map((lr) => ({
    employeeName: `${lr.employee.lastName}, ${lr.employee.firstName}`.trim(),
    departmentName: lr.employee.department?.name ?? "",
    type: LEAVE_TYPE_LABELS_SQ[lr.type],
    subtype: lr.subtype === "NONE" ? "" : LEAVE_SUBTYPE_LABELS_SQ[lr.subtype],
    status: LEAVE_STATUS_LABELS_SQ[lr.status],
    startDate: isoDay(lr.startDate),
    endDate: isoDay(lr.endDate),
    totalDays: lr.totalDays?.toString() ?? "",
    workingDays: lr.workingDays?.toString() ?? "",
    totalHours: lr.totalHours?.toString() ?? "",
    isPaid: yesNo(lr.isPaid),
    affectsPayroll: yesNo(lr.affectsPayroll),
    reason: lr.reason ?? "",
    rejectionReason: lr.rejectionReason ?? "",
    balanceOverrideApprovedBy: lr.balanceOverrideApprovedBy ?? "",
    createdAt: isoDay(lr.createdAt),
    decidedAt: isoDay(lr.decidedAt),
    decidedBy:
      lr.decidedByMembership?.user.displayName?.trim() ||
      lr.decidedByMembership?.user.email?.trim() ||
      "",
    documentCount: lr.documents.length,
  }));

  // The BOM lives in rowsToCsvBuffer itself, so every CSV in the app gets it.
  const buf = rowsToCsvBuffer(COLUMNS, csvRows);

  const period = allMonths ? String(year) : `${year}-${String(month).padStart(2, "0")}`;

  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="Pushimet_${period}.csv"`,
      "Cache-Control": "no-store",
      // Surfaced so a truncated export is discoverable rather than silent.
      "X-Pagapro-Row-Count": String(csvRows.length),
      ...(truncated ? { "X-Pagapro-Truncated": "1" } : {}),
    },
  });
}
