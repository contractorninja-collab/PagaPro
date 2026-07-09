import { Decimal } from "decimal.js";

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
