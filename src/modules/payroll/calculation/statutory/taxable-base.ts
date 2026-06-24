import type { LegislationSnapshot } from "../types";
import { D } from "../money/decimal";
import { roundMoneyEUR } from "../money/rounding";
import Decimal from "decimal.js";

export function computeTaxableIncome(params: {
  grossSalary: Decimal;
  pensionEmployee: Decimal;
  pitRules: LegislationSnapshot["pitRules"];
}): Decimal {
  const rounded = params.pitRules.employeePensionReducesTaxableBase
    ? roundMoneyEUR(params.grossSalary.minus(params.pensionEmployee))
    : roundMoneyEUR(params.grossSalary);
  /** Half-up rounding can leave taxable slightly negative at tiny grosses; PIT layer throws on negative taxable. */
  return Decimal.max(D("0"), rounded);
}

export function computeSecondaryPitBase(params: {
  grossSalary: Decimal;
  taxableIncome: Decimal;
  pitBaseKind: LegislationSnapshot["secondaryEmployerPitBase"];
}): Decimal {
  if (params.pitBaseKind === "GROSS") {
    return roundMoneyEUR(params.grossSalary);
  }
  return roundMoneyEUR(params.taxableIncome);
}
