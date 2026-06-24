import type { HourBreakdown, PayrollCalculationIssue } from "../types";
import { D } from "../money/decimal";

export function validateHourBreakdown(hours: HourBreakdown): PayrollCalculationIssue[] {
  const issues: PayrollCalculationIssue[] = [];

  const buckets: Array<[string, string | undefined]> = [
    ["regularHours", hours.regularHours],
    ["overtimeHours", hours.overtimeHours],
    ["holidayHours", hours.holidayHours],
    ["weekendHours", hours.weekendHours],
    ["nightHours", hours.nightHours],
  ];

  for (const [label, raw] of buckets) {
    const v = D(raw ?? "0");
    if (!v.isFinite() || v.isNegative()) {
      issues.push({
        code: "NEGATIVE_OR_NON_FINITE_HOURS",
        message: `${label} must be a finite number ≥ 0`,
      });
    }
  }

  return issues;
}
