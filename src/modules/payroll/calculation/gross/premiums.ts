import type { PremiumRules } from "../types";
import { D } from "../money/decimal";
import type { Decimal } from "decimal.js";

function multOrOne(key: keyof PremiumRules, rules: PremiumRules): Decimal {
  const raw = rules[key];
  if (raw === undefined) return D("1");
  const m = D(raw);
  if (!m.isFinite() || m.lte(0)) {
    throw new Error(`Invalid premium multiplier for ${String(key)}`);
  }
  return m;
}

export interface PremiumPayParts {
  overtimePay: Decimal;
  holidayPay: Decimal;
  weekendPay: Decimal;
  nightPay: Decimal;
}

/**
 * Hours that overlap a higher-paying bucket. Their base is already paid there, so
 * they earn only the uplift (multiplier − 1) and the same hour is never paid twice.
 *
 * A Sunday 23:00 hour arrives as 1 weekend hour + 1 night *stack* hour and pays
 * 1.5× + 0.3× = 1.8×; counting it as a full hour in both buckets would pay 2.8×.
 */
export interface PremiumStackHours {
  overtimeStackHours?: Decimal;
  nightStackHours?: Decimal;
}

/** Applies hourly premiums to distinct hour buckets (additive across buckets). */
export function computePremiumPays(
  hourlyRate: Decimal,
  rules: PremiumRules,
  overtimeHours: Decimal,
  holidayHours: Decimal,
  weekendHours: Decimal,
  nightHours: Decimal,
  stack?: PremiumStackHours,
): PremiumPayParts {
  const ot = multOrOne("overtimeHourMultiplier", rules);
  const hol = multOrOne("holidayHourMultiplier", rules);
  const we = multOrOne("weekendHourMultiplier", rules);
  const nw = multOrOne("nightHourMultiplier", rules);

  // Uplift only — the base for these hours lives in whichever bucket outranked them.
  const otStack = stack?.overtimeStackHours ?? D("0");
  const nightStack = stack?.nightStackHours ?? D("0");
  const otUplift = ot.minus(1);
  const nightUplift = nw.minus(1);

  return {
    overtimePay: hourlyRate.mul(overtimeHours).mul(ot).plus(hourlyRate.mul(otStack).mul(otUplift)),
    holidayPay: hourlyRate.mul(holidayHours).mul(hol),
    weekendPay: hourlyRate.mul(weekendHours).mul(we),
    nightPay: hourlyRate.mul(nightHours).mul(nw).plus(hourlyRate.mul(nightStack).mul(nightUplift)),
  };
}
