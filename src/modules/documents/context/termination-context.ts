import { formatMoneyEUR, formatTemplateDate } from "./format";
import { TERMINATION_TYPE_LABELS, TERMINATION_STATUS_LABELS } from "@/modules/terminations/types";
import type { TerminationType } from "@prisma/client";

export function buildTerminationPlaceholderMap(
  row: {
    terminationDate: Date;
    lastWorkingDay: Date;
    noticeDate?: Date | null;
    type: string;
    status: string;
    noticeDays: number | null;
    severanceAmount: string | { toFixed(n: number): string } | null;
    reason: string | null;
    details?: string | null;
  },
  locale = "sq-AL",
): Record<string, string> {
  const severance =
    row.severanceAmount == null
      ? ""
      : typeof row.severanceAmount === "string"
        ? formatMoneyEUR(row.severanceAmount)
        : formatMoneyEUR(row.severanceAmount.toFixed(2));

  const reason = row.reason ?? "";
  const detailBlock = row.details?.trim() ?? "";
  const typeLabel = TERMINATION_TYPE_LABELS[row.type as TerminationType] ?? row.type;
  const statusLabel = TERMINATION_STATUS_LABELS[row.status] ?? row.status;

  const legacy = {
    termination_last_working_day: formatTemplateDate(row.lastWorkingDay, locale),
    termination_type: row.type,
    termination_status: row.status,
    termination_notice_days: row.noticeDays != null ? String(row.noticeDays) : "",
    termination_severance: severance,
    termination_reason: reason,
  };

  return {
    ...legacy,
    termination_date: formatTemplateDate(row.terminationDate, locale),
    last_working_day: formatTemplateDate(row.lastWorkingDay, locale),
    termination_notice_date: row.noticeDate ? formatTemplateDate(row.noticeDate, locale) : "",
    termination_type_label: typeLabel,
    termination_status_label: statusLabel,
    termination_reason: reason,
    termination_details: detailBlock,
  };
}
