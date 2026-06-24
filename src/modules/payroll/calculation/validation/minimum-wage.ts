import type { LegislationSnapshot, PayrollCalculationIssue } from "../types";
import { D } from "../money/decimal";
import type Decimal from "decimal.js";

export function validateMinimumCompensation(params: {
  grossSalary: Decimal;
  hourlyRate: Decimal;
  snapshot: LegislationSnapshot;
  enforceMinimumGross: boolean;
  /**
   * Hourly minimum checks compare `hourlyRate` to legislation — meaningless when gross is supplied
   * via override (spreadsheet / net solver pass a placeholder rate while validating final gross).
   */
  skipHourlyMinimum?: boolean;
}): PayrollCalculationIssue[] {
  const issues: PayrollCalculationIssue[] = [];
  const minGross = D(params.snapshot.minimumMonthlyGross);

  if (params.enforceMinimumGross && params.grossSalary.lt(minGross)) {
    issues.push({
      code: "BELOW_MINIMUM_GROSS",
      message: `grossSalary ${params.grossSalary.toFixed(2)} is below minimumMonthlyGross ${minGross.toFixed(2)}`,
    });
  }

  if (params.skipHourlyMinimum) {
    return issues;
  }

  if (params.snapshot.minimumHourlyWage !== undefined) {
    const minHourly = D(params.snapshot.minimumHourlyWage);
    if (params.hourlyRate.lt(minHourly)) {
      issues.push({
        code: "BELOW_MINIMUM_HOURLY",
        message: `hourlyRate ${params.hourlyRate.toFixed(4)} is below minimumHourlyWage ${minHourly.toFixed(4)}`,
      });
    }
  }

  if (
    params.snapshot.minimumHourlyWage === undefined &&
    params.snapshot.standardMonthlyHours !== undefined
  ) {
    const hours = D(params.snapshot.standardMonthlyHours);
    if (!hours.isFinite() || hours.lte(0)) {
      issues.push({
        code: "MISSING_STANDARD_HOURS_FOR_HOURLY_MIN",
        message: "standardMonthlyHours must be > 0 when used for derived hourly minimum",
      });
    } else {
      const derivedMinHourly = minGross.div(hours);
      if (params.hourlyRate.lt(derivedMinHourly)) {
        issues.push({
          code: "BELOW_MINIMUM_HOURLY",
          message: `hourlyRate ${params.hourlyRate.toFixed(4)} is below derived minimum ${derivedMinHourly.toFixed(4)} (minimumMonthlyGross ${minGross.toFixed(2)} / standardMonthlyHours ${hours.toFixed(2)})`,
        });
      }
    }
  }

  return issues;
}
