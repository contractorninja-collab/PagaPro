import { formatTemplateDate } from "./format";
import { LEAVE_TYPE_LABELS_SQ, LEAVE_SUBTYPE_LABELS_SQ } from "@/modules/leaves/helpers/leave-type-metadata";
import { LEAVE_STATUS_LABELS_SQ } from "@/modules/leaves/helpers/leave-status-labels";
import type { LeaveRequestStatus, LeaveSubtype, LeaveType } from "@prisma/client";

/** Decimal-ish → display string without trailing ".00" noise ("5", "2.5"). */
function days(v: { toString(): string } | null | undefined): string {
  if (v == null) return "";
  const n = Number(v.toString());
  if (!Number.isFinite(n)) return "";
  return Number.isInteger(n) ? String(n) : String(Math.round(n * 100) / 100);
}

export function buildLeavePlaceholderMap(
  row: {
    startDate: Date;
    endDate: Date;
    type: string;
    subtype?: string | null;
    status: string;
    reason: string | null;
    workingDays?: { toString(): string } | null;
    totalDays?: { toString(): string } | null;
    decidedAt?: Date | null;
    isPaid?: boolean;
  },
  balance?: {
    yearlyQuota: { toString(): string };
    usedDays: { toString(): string };
    remainingDays: { toString(): string };
    carryOverDays: { toString(): string };
  } | null,
  locale = "sq-AL",
): Record<string, string> {
  const typeLabel = LEAVE_TYPE_LABELS_SQ[row.type as LeaveType] ?? row.type;
  const statusLabel = LEAVE_STATUS_LABELS_SQ[row.status as LeaveRequestStatus] ?? row.status;
  const subtype = (row.subtype ?? "NONE") as LeaveSubtype;
  const subtypeLabel = subtype === "NONE" ? "" : LEAVE_SUBTYPE_LABELS_SQ[subtype] ?? "";

  return {
    leave_start_date: formatTemplateDate(row.startDate, locale),
    leave_end_date: formatTemplateDate(row.endDate, locale),
    leave_type: row.type,
    leave_type_label: typeLabel,
    leave_subtype_label: subtypeLabel,
    leave_status: row.status,
    leave_status_label: statusLabel,
    leave_note: row.reason ?? "",
    leave_working_days: days(row.workingDays),
    leave_total_days: days(row.totalDays),
    leave_year: String(row.startDate.getUTCFullYear()),
    leave_decision_date: row.decidedAt ? formatTemplateDate(row.decidedAt, locale) : "",
    leave_paid_label: row.isPaid == null ? "" : row.isPaid ? "me pagesë" : "pa pagesë",
    leave_quota_days: days(balance?.yearlyQuota),
    leave_used_days: days(balance?.usedDays),
    leave_remaining_days: days(balance?.remainingDays),
    leave_carry_over_days: days(balance?.carryOverDays),
  };
}
