import { formatTemplateDate } from "./format";

export function buildWarningPlaceholderMap(
  row: {
    issuedAt: Date;
    summary: string;
    severity: string | null;
    status: string;
  },
  locale = "sq-AL",
): Record<string, string> {
  return {
    warning_issued_at: formatTemplateDate(row.issuedAt, locale),
    warning_summary: row.summary,
    warning_severity: row.severity ?? "",
    warning_status: row.status,
  };
}
