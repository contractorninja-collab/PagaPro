import { formatTemplateDate } from "./format";

export function buildLeavePlaceholderMap(
  row: {
    startDate: Date;
    endDate: Date;
    type: string;
    status: string;
    reason: string | null;
  },
  locale = "sq-AL",
): Record<string, string> {
  return {
    leave_start_date: formatTemplateDate(row.startDate, locale),
    leave_end_date: formatTemplateDate(row.endDate, locale),
    leave_type: row.type,
    leave_status: row.status,
    leave_note: row.reason ?? "",
  };
}
