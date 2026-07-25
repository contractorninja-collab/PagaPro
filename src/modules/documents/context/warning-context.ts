import { formatTemplateDate } from "./format";

/** Masat e nenit 85.1 që PagaPRO shqipton përmes vërejtjeve. */
export const WARNING_MEASURE_LABELS: Record<string, string> = {
  VERBALE: "vërejtje me gojë (neni 85.1.1)",
  ME_SHKRIM: "vërejtje me shkrim (neni 85.1.2)",
};

export function warningMeasureLabel(measure: string | null): string {
  if (!measure) return "";
  return WARNING_MEASURE_LABELS[measure] ?? measure;
}

export function buildWarningPlaceholderMap(
  row: {
    issuedAt: Date;
    summary: string;
    severity: string | null;
    status: string;
    measure?: string | null;
    improvementDeadline?: Date | null;
  },
  locale = "sq-AL",
): Record<string, string> {
  return {
    warning_issued_at: formatTemplateDate(row.issuedAt, locale),
    warning_summary: row.summary,
    warning_severity: row.severity ?? "",
    warning_status: row.status,
    warning_measure: warningMeasureLabel(row.measure ?? null),
    warning_improvement_deadline: row.improvementDeadline
      ? formatTemplateDate(row.improvementDeadline, locale)
      : "",
  };
}
