import { formatMoneyEUR, formatTemplateDate } from "./format";

export function buildTerminationPlaceholderMap(
  row: {
    terminationDate: Date;
    lastWorkingDay: Date;
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
    termination_reason: reason,
    termination_details: detailBlock,
  };
}
