import Decimal from "decimal.js";

/** EUR payroll lines: half-up to 2 decimal places. */
export function roundMoneyEUR(amount: Decimal): Decimal {
  return amount.toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
}

export const ROUNDING_POLICY_VERSION = "EUR_HALF_UP_2DP_v1" as const;
