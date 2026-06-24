import type {
  EmployerPrimacy,
  LegislationSnapshot,
  PitBreakdown,
} from "../types";
import type Decimal from "decimal.js";
import { D } from "../money/decimal";
import { computeSecondaryPitBase, computeTaxableIncome } from "./taxable-base";
import { computePrimaryProgressivePit } from "./pit-brackets";
import { computeSecondaryFlatWithholding } from "./pit-flat-withholding";

export function computeEmployeePit(params: {
  employerPrimacy: EmployerPrimacy;
  grossSalary: Decimal;
  pensionEmployee: Decimal;
  snapshot: LegislationSnapshot;
}): { pitWithheld: Decimal; taxableIncome: Decimal; pitBreakdown: PitBreakdown } {
  const taxableIncome = computeTaxableIncome({
    grossSalary: params.grossSalary,
    pensionEmployee: params.pensionEmployee,
    pitRules: params.snapshot.pitRules,
  });

  if (params.employerPrimacy === "SECONDARY") {
    const flatRate = D(params.snapshot.secondaryEmployerFlatRate);
    const pitBase = computeSecondaryPitBase({
      grossSalary: params.grossSalary,
      taxableIncome,
      pitBaseKind: params.snapshot.secondaryEmployerPitBase,
    });

    const result = computeSecondaryFlatWithholding({
      pitBase,
      flatRate,
      pitBaseKind: params.snapshot.secondaryEmployerPitBase,
    });

    return {
      pitWithheld: result.pitWithheld,
      taxableIncome,
      pitBreakdown: result.breakdown,
    };
  }

  const primary = computePrimaryProgressivePit({
    taxableIncome,
    pitBands: params.snapshot.pitBands,
  });

  return {
    pitWithheld: primary.pitWithheld,
    taxableIncome,
    pitBreakdown: primary.breakdown,
  };
}
