import type { LegislationSnapshot, PitPrimaryBreakdown } from "../types";
import Decimal from "decimal.js";
import { D } from "../money/decimal";
import { roundMoneyEUR } from "../money/rounding";

export function computePrimaryProgressivePit(params: {
  taxableIncome: Decimal;
  pitBands: LegislationSnapshot["pitBands"];
}): { pitWithheld: Decimal; breakdown: PitPrimaryBreakdown } {
  const taxable = params.taxableIncome;
  if (taxable.isNegative()) {
    throw new Error("taxableIncome cannot be negative");
  }

  const bands = [...params.pitBands].sort((a, b) =>
    D(a.cumulativeUpperInclusive).comparedTo(D(b.cumulativeUpperInclusive)),
  );

  let prevUpper = D("0");
  let pitAccumulator = D("0");
  const bracketSlices: PitPrimaryBreakdown["bracketSlices"] = [];

  for (const band of bands) {
    const upper = D(band.cumulativeUpperInclusive);
    const rate = D(band.rate);
    if (!upper.isFinite() || upper.lt(prevUpper)) {
      throw new Error("Invalid pit band ordering");
    }
    if (!rate.isFinite() || rate.isNegative() || rate.gt(1)) {
      throw new Error("Invalid pit band rate");
    }

    if (taxable.lte(prevUpper)) break;

    const cappedTaxable = Decimal.min(taxable, upper);
    const sliceTaxable = cappedTaxable.minus(prevUpper);
    const safeSlice = sliceTaxable.gt(0) ? sliceTaxable : D("0");
    const bandTaxUnrounded = safeSlice.mul(rate);

    bracketSlices.push({
      from: prevUpper.toFixed(2),
      to: cappedTaxable.toFixed(2),
      rate: rate.toFixed(),
      sliceTaxable: safeSlice.toFixed(2),
      taxAmount: roundMoneyEUR(bandTaxUnrounded).toFixed(2),
    });

    pitAccumulator = pitAccumulator.plus(bandTaxUnrounded);
    prevUpper = upper;

    if (taxable.lte(upper)) break;
  }

  const pitWithheld = roundMoneyEUR(pitAccumulator);

  return {
    pitWithheld,
    breakdown: {
      atkRegime: "PRIMARY_PROGRESSIVE",
      taxableIncome: taxable.toFixed(2),
      pitWithheld: pitWithheld.toFixed(2),
      bracketSlices,
    },
  };
}
