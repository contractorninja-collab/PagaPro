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

/** Applies hourly premiums to distinct hour buckets (additive across buckets). */
export function computePremiumPays(
  hourlyRate: Decimal,
  rules: PremiumRules,
  overtimeHours: Decimal,
  holidayHours: Decimal,
  weekendHours: Decimal,
  nightHours: Decimal,
): PremiumPayParts {
  const ot = multOrOne("overtimeHourMultiplier", rules);
  const hol = multOrOne("holidayHourMultiplier", rules);
  const we = multOrOne("weekendHourMultiplier", rules);
  const nw = multOrOne("nightHourMultiplier", rules);

  // stackPolicy reserved for future overlap semantics; distinct buckets remain additive.
  return {
    overtimePay: hourlyRate.mul(overtimeHours).mul(ot),
    holidayPay: hourlyRate.mul(holidayHours).mul(hol),
    weekendPay: hourlyRate.mul(weekendHours).mul(we),
    nightPay: hourlyRate.mul(nightHours).mul(nw),
  };
}
