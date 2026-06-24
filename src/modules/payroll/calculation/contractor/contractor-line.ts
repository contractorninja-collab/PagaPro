import type {
  CalculateContractorLineInput,
  CalculateContractorLineOutput,
  CalculationBreakdownPayload,
  LegislationSnapshot,
  PitBreakdown,
} from "../types";
import { D } from "../money/decimal";
import { roundMoneyEUR } from "../money/rounding";
import { computeGrossFromHours } from "../gross/from-hours";
import { computePensionContributions } from "../statutory/pension";
import { computeSecondaryPitBase, computeTaxableIncome } from "../statutory/taxable-base";
import { computeSecondaryFlatWithholding } from "../statutory/pit-flat-withholding";
import { ROUNDING_POLICY_VERSION } from "../money/rounding";

function exemptBreakdown(): PitBreakdown {
  return { atkRegime: "CONTRACTOR_EXEMPT", pitWithheld: "0.00" };
}

export function calculateContractorLine(
  input: CalculateContractorLineInput,
  snapshot: LegislationSnapshot,
): CalculateContractorLineOutput {
  const otherDeductions = roundMoneyEUR(D(input.otherDeductions ?? "0"));
  if (otherDeductions.isNegative()) {
    throw new Error("otherDeductions cannot be negative");
  }

  const bonusAmount = roundMoneyEUR(D(input.bonusAmount ?? "0"));
  if (bonusAmount.isNegative()) {
    throw new Error("bonusAmount cannot be negative");
  }

  const grossComputation = input.grossSalaryOverride
    ? {
        grossDecimal: roundMoneyEUR(D(input.grossSalaryOverride)),
        breakdown: {
          regularPay: roundMoneyEUR(D(input.grossSalaryOverride)).toFixed(2),
          overtimePay: "0.00",
          holidayPay: "0.00",
          weekendPay: "0.00",
          nightPay: "0.00",
          bonuses: "0.00",
          grossSalary: roundMoneyEUR(D(input.grossSalaryOverride)).toFixed(2),
        },
      }
    : computeGrossFromHours({
        hours: input.hours,
        rates: input.rates,
        snapshot,
      });

  const grossSalary = roundMoneyEUR(grossComputation.grossDecimal.plus(bonusAmount));
  const grossBreakdown = {
    ...grossComputation.breakdown,
    bonuses: bonusAmount.toFixed(2),
    grossSalary: grossSalary.toFixed(2),
  };

  const withholdingMode = input.contractorWithholdingMode ?? "NONE";
  const employerPrimacy = input.employerPrimacy ?? "PRIMARY";

  const pensionRates = {
    pensionEmployeeRate:
      input.pensionEmployeeRate ?? snapshot.pensionEmployeeRate,
    pensionEmployerRate:
      input.pensionEmployerRate ?? snapshot.pensionEmployerRate,
  };

  const pitRules = input.pitRules ?? snapshot.pitRules;

  let pensionEmployee = D("0");
  let pensionEmployer = D("0");
  let taxableIncome = grossSalary;
  let pitWithheld = D("0");
  let pitBreakdown: PitBreakdown = exemptBreakdown();
  let atkRegime: CalculationBreakdownPayload["atkRegime"] = "CONTRACTOR_EXEMPT";

  if (withholdingMode === "SECONDARY_FLAT_10") {
    atkRegime = "SECONDARY_FLAT_10";
    if (input.applyTrustContributions) {
      const pension = computePensionContributions({
        grossSalary,
        snapshot: pensionRates,
      });
      pensionEmployee = pension.pensionEmployee;
      pensionEmployer = pension.pensionEmployer;
      taxableIncome = computeTaxableIncome({
        grossSalary,
        pensionEmployee,
        pitRules,
      });
    } else {
      taxableIncome = computeTaxableIncome({
        grossSalary,
        pensionEmployee: D("0"),
        pitRules,
      });
    }

    const flatRate = D(
      input.secondaryEmployerFlatRate ?? snapshot.secondaryEmployerFlatRate,
    );
    const pitBaseKind =
      input.secondaryEmployerPitBase ?? snapshot.secondaryEmployerPitBase;
    const pitBase = computeSecondaryPitBase({
      grossSalary,
      taxableIncome,
      pitBaseKind,
    });

    const pitResult = computeSecondaryFlatWithholding({
      pitBase,
      flatRate,
      pitBaseKind,
    });
    pitWithheld = pitResult.pitWithheld;
    pitBreakdown = pitResult.breakdown;
  }

  const netPay = roundMoneyEUR(
    grossSalary.minus(pensionEmployee).minus(pitWithheld).minus(otherDeductions),
  );

  const breakdown: CalculationBreakdownPayload = {
    rulesVersion: snapshot.rulesVersion,
    snapshotId: snapshot.snapshotId,
    effectiveFromIso: snapshot.effectiveFromIso,
    roundingPolicyVersion: ROUNDING_POLICY_VERSION,
    employerPrimacy,
    atkRegime,
    gross: grossBreakdown,
    pension: {
      pensionEmployee: pensionEmployee.toFixed(2),
      pensionEmployer: pensionEmployer.toFixed(2),
    },
    taxableIncome: taxableIncome.toFixed(2),
    pit: pitBreakdown,
    netPay: netPay.toFixed(2),
  };

  return {
    grossSalary: grossSalary.toFixed(2),
    taxableIncome: taxableIncome.toFixed(2),
    pitWithheld: pitWithheld.toFixed(2),
    pensionEmployee: pensionEmployee.toFixed(2),
    pensionEmployer: pensionEmployer.toFixed(2),
    otherDeductions: otherDeductions.toFixed(2),
    netPay: netPay.toFixed(2),
    breakdown,
  };
}
