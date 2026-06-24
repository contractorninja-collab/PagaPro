import { Decimal } from "decimal.js";

export type AccrualModelId = "KOSOVO_MONTHLY_LINEAR";

export function monthlyAccrualWorkingDays(model: AccrualModelId, monthlyRateFromPolicy: number): number {
  switch (model) {
    case "KOSOVO_MONTHLY_LINEAR":
      return Math.max(0, Number(monthlyRateFromPolicy) || 0);
    default: {
      const _exhaustive: never = model;
      return _exhaustive;
    }
  }
}

/** YTD accrual from calendar months worked in entitlement year (simple full-month counting). */
export function accruedYtdLinearMonths(params: {
  monthsWorkedInYear: number;
  monthlyRate: number;
  capAtAnnualEntitlement: number;
}): number {
  const raw = new Decimal(params.monthlyRate).mul(Math.max(0, params.monthsWorkedInYear));
  const capped = Decimal.min(raw, new Decimal(Math.max(0, params.capAtAnnualEntitlement)));
  return capped.toDecimalPlaces(4, Decimal.ROUND_HALF_UP).toNumber();
}
