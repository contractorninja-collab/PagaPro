import type { GrossBreakdown, HourBreakdown, HourlyRates, LegislationSnapshot } from "../types";
import { D } from "../money/decimal";
import { roundMoneyEUR } from "../money/rounding";
import type { Decimal } from "decimal.js";
import { computePremiumPays } from "./premiums";

function parseHours(value: string | undefined, label: string): Decimal {
  const v = D(value ?? "0");
  if (!v.isFinite() || v.isNegative()) {
    throw new Error(`Invalid hours for ${label}`);
  }
  return v;
}

export interface GrossFromHoursInput {
  hours: HourBreakdown;
  rates: HourlyRates;
  snapshot: Pick<LegislationSnapshot, "premiumRules">;
}

export function computeGrossFromHours(input: GrossFromHoursInput): {
  breakdown: GrossBreakdown;
  grossDecimal: Decimal;
} {
  const hourlyRate = D(input.rates.hourlyRate);
  if (!hourlyRate.isFinite() || hourlyRate.lte(0)) {
    throw new Error("hourlyRate must be > 0");
  }

  const regularHours = parseHours(input.hours.regularHours, "regularHours");
  const overtimeHours = parseHours(input.hours.overtimeHours, "overtimeHours");
  const holidayHours = parseHours(input.hours.holidayHours, "holidayHours");
  const weekendHours = parseHours(input.hours.weekendHours, "weekendHours");
  const nightHours = parseHours(input.hours.nightHours, "nightHours");

  const regularPay = hourlyRate.mul(regularHours);

  const premiums = computePremiumPays(
    hourlyRate,
    input.snapshot.premiumRules,
    overtimeHours,
    holidayHours,
    weekendHours,
    nightHours,
  );

  const overtimePay = premiums.overtimePay;
  const holidayPay = premiums.holidayPay;
  const weekendPay = premiums.weekendPay;
  const nightPay = premiums.nightPay;

  const grossDecimal = roundMoneyEUR(
    regularPay.plus(overtimePay).plus(holidayPay).plus(weekendPay).plus(nightPay),
  );

  const breakdown: GrossBreakdown = {
    regularPay: roundMoneyEUR(regularPay).toFixed(2),
    overtimePay: roundMoneyEUR(overtimePay).toFixed(2),
    holidayPay: roundMoneyEUR(holidayPay).toFixed(2),
    weekendPay: roundMoneyEUR(weekendPay).toFixed(2),
    nightPay: roundMoneyEUR(nightPay).toFixed(2),
    bonuses: "0.00",
    grossSalary: grossDecimal.toFixed(2),
  };

  return { breakdown, grossDecimal };
}
