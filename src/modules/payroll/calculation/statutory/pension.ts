import type { LegislationSnapshot } from "../types";
import { D } from "../money/decimal";
import { roundMoneyEUR } from "../money/rounding";
import type { Decimal } from "decimal.js";

export interface PensionInput {
  grossSalary: Decimal;
  snapshot: Pick<LegislationSnapshot, "pensionEmployeeRate" | "pensionEmployerRate">;
}

export function computePensionContributions(input: PensionInput): {
  pensionEmployee: Decimal;
  pensionEmployer: Decimal;
} {
  const re = D(input.snapshot.pensionEmployeeRate);
  const rr = D(input.snapshot.pensionEmployerRate);
  if (!re.isFinite() || re.isNegative() || re.gt(1)) {
    throw new Error("pensionEmployeeRate must be in [0,1]");
  }
  if (!rr.isFinite() || rr.isNegative() || rr.gt(1)) {
    throw new Error("pensionEmployerRate must be in [0,1]");
  }

  return {
    pensionEmployee: roundMoneyEUR(input.grossSalary.mul(re)),
    pensionEmployer: roundMoneyEUR(input.grossSalary.mul(rr)),
  };
}
