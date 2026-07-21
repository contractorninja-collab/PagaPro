import type {
  CalculateEmployeeLineInput,
  CalculateEmployeeLineOutput,
  CalculationBreakdownPayload,
  LegislationSnapshot,
  PayrollCalculationIssue,
  PayrollCalculationResult,
} from "./types";
import { D } from "./money/decimal";
import { roundMoneyEUR, ROUNDING_POLICY_VERSION } from "./money/rounding";
import { computeGrossFromHours } from "./gross/from-hours";
import { computePensionContributions } from "./statutory/pension";
import { computeEmployeePit, computeEmployeePitExempt } from "./statutory/pit-policy";
import { validateHourBreakdown } from "./validation/hours";
import { validateLegislationSnapshot } from "./validation/parameters";
import { validateMinimumCompensation } from "./validation/minimum-wage";

function mergeIssues(...groups: PayrollCalculationIssue[][]): PayrollCalculationIssue[] {
  return groups.flat();
}
export function calculateEmployeeLine(
  input: CalculateEmployeeLineInput,
  snapshot: LegislationSnapshot,
): PayrollCalculationResult<CalculateEmployeeLineOutput> {
  if (input.employmentType !== "EMPLOYEE") {
    return {
      ok: false,
      issues: [
        {
          code: "INVALID_EMPLOYMENT_TYPE_FOR_EMPLOYEE_CALCULATOR",
          message: "calculateEmployeeLine expects employmentType = EMPLOYEE",
        },
      ],
    };
  }

  const otherDeductions = roundMoneyEUR(D(input.otherDeductions ?? "0"));
  const bonusAmount = roundMoneyEUR(D(input.bonusAmount ?? "0"));
  const preliminaryIssues = mergeIssues(
    validateHourBreakdown(input.hours),
    validateLegislationSnapshot(snapshot),
  );

  const hourlyRate = D(input.rates.hourlyRate);
  if (!hourlyRate.isFinite() || hourlyRate.lte(0)) {
    preliminaryIssues.push({
      code: "NEGATIVE_OR_ZERO_HOURLY_RATE",
      message: "rates.hourlyRate must be a finite number > 0",
    });
  }

  if (otherDeductions.isNegative()) {
    preliminaryIssues.push({
      code: "INVALID_OTHER_DEDUCTIONS",
      message: "otherDeductions cannot be negative",
    });
  }

  if (bonusAmount.isNegative()) {
    preliminaryIssues.push({
      code: "INVALID_BONUS_AMOUNT",
      message: "bonusAmount cannot be negative",
    });
  }

  if (preliminaryIssues.length > 0) {
    return { ok: false, issues: preliminaryIssues };
  }

  let grossComputation: ReturnType<typeof computeGrossFromHours>;
  if (input.grossSalaryOverride !== undefined) {
    const baseGross = roundMoneyEUR(D(input.grossSalaryOverride));
    grossComputation = {
      grossDecimal: baseGross,
      breakdown: {
        regularPay: baseGross.toFixed(2),
        overtimePay: "0.00",
        holidayPay: "0.00",
        weekendPay: "0.00",
        nightPay: "0.00",
        bonuses: "0.00",
        grossSalary: baseGross.toFixed(2),
      },
    };
  } else {
    grossComputation = computeGrossFromHours({
      hours: input.hours,
      rates: input.rates,
      snapshot,
    });
  }

  const grossDecimal = roundMoneyEUR(grossComputation.grossDecimal.plus(bonusAmount));
  const grossBreakdown = {
    ...grossComputation.breakdown,
    bonuses: bonusAmount.toFixed(2),
    grossSalary: grossDecimal.toFixed(2),
  };

  if (grossDecimal.lte(0)) {
    return {
      ok: false,
      issues: [
        {
          code: "INVALID_GROSS_SALARY",
          message: "Bruto e llogaritur duhet të jetë më e madhe se zero.",
        },
      ],
    };
  }

  const enforceMinimum = input.enforceMinimumGross ?? true;
  const minIssues = validateMinimumCompensation({
    grossSalary: grossDecimal,
    hourlyRate,
    snapshot,
    enforceMinimumGross: enforceMinimum,
    skipHourlyMinimum: input.grossSalaryOverride !== undefined,
  });

  if (minIssues.length > 0) {
    return { ok: false, issues: minIssues };
  }

  const applyTrust = input.applyTrust ?? true;
  const applyTax = input.applyTax ?? true;

  const pension = applyTrust
    ? computePensionContributions({
        grossSalary: grossDecimal,
        snapshot,
      })
    : { pensionEmployee: D("0"), pensionEmployer: D("0") };

  const pitResult = applyTax
    ? computeEmployeePit({
        employerPrimacy: input.employerPrimacy,
        grossSalary: grossDecimal,
        pensionEmployee: pension.pensionEmployee,
        snapshot,
      })
    : computeEmployeePitExempt({
        employerPrimacy: input.employerPrimacy,
        grossSalary: grossDecimal,
        pensionEmployee: pension.pensionEmployee,
        snapshot,
      });

  const netPay = roundMoneyEUR(
    grossDecimal.minus(pension.pensionEmployee).minus(pitResult.pitWithheld).minus(otherDeductions),
  );

  const atkRegime: CalculationBreakdownPayload["atkRegime"] =
    input.employerPrimacy === "SECONDARY"
      ? "SECONDARY_FLAT_10"
      : "PRIMARY_PROGRESSIVE";

  const breakdown: CalculationBreakdownPayload = {
    rulesVersion: snapshot.rulesVersion,
    snapshotId: snapshot.snapshotId,
    effectiveFromIso: snapshot.effectiveFromIso,
    roundingPolicyVersion: ROUNDING_POLICY_VERSION,
    employerPrimacy: input.employerPrimacy,
    atkRegime,
    gross: grossBreakdown,
    pension: {
      pensionEmployee: pension.pensionEmployee.toFixed(2),
      pensionEmployer: pension.pensionEmployer.toFixed(2),
    },
    taxableIncome: pitResult.taxableIncome.toFixed(2),
    pit: pitResult.pitBreakdown,
    netPay: netPay.toFixed(2),
  };

  return {
    ok: true,
    value: {
      grossSalary: grossDecimal.toFixed(2),
      taxableIncome: pitResult.taxableIncome.toFixed(2),
      pitWithheld: pitResult.pitWithheld.toFixed(2),
      pensionEmployee: pension.pensionEmployee.toFixed(2),
      pensionEmployer: pension.pensionEmployer.toFixed(2),
      otherDeductions: otherDeductions.toFixed(2),
      netPay: netPay.toFixed(2),
      breakdown,
    },
  };
}

