import type { LegislationSnapshot, PitSecondaryBreakdown } from "../types";
import { roundMoneyEUR } from "../money/rounding";
import type Decimal from "decimal.js";

export function computeSecondaryFlatWithholding(params: {
  pitBase: Decimal;
  flatRate: Decimal;
  pitBaseKind: LegislationSnapshot["secondaryEmployerPitBase"];
}): { pitWithheld: Decimal; breakdown: PitSecondaryBreakdown } {
  const rate = params.flatRate;
  if (!rate.isFinite() || rate.isNegative() || rate.gt(1)) {
    throw new Error("secondaryEmployerFlatRate must be in [0,1]");
  }
  if (params.pitBase.isNegative()) {
    throw new Error("pitBase cannot be negative");
  }

  const pitUnrounded = params.pitBase.mul(rate);
  const pitWithheld = roundMoneyEUR(pitUnrounded);

  return {
    pitWithheld,
    breakdown: {
      atkRegime: "SECONDARY_FLAT_10",
      pitBaseKind: params.pitBaseKind,
      pitBaseAmount: roundMoneyEUR(params.pitBase).toFixed(2),
      flatRate: rate.toFixed(),
      pitWithheld: pitWithheld.toFixed(2),
    },
  };
}
