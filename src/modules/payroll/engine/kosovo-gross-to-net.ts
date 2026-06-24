import type {
  CalculateEmployeeLineOutput,
  PayrollCalculationResult,
} from "@/modules/payroll/calculation/types";
import { kosovo2026AtkDefaults } from "@/modules/payroll/calculation/legislation/defaults";
import { calculateEmployeeLine } from "@/modules/payroll/calculation/payroll-calculator";
import { D } from "@/modules/payroll/calculation/money/decimal";
import { roundMoneyEUR } from "@/modules/payroll/helpers/payroll-rounding";

export interface KosovoPrimaryPayrollFromGrossInput {
  grossSalary: string;
  /** Defaults to Kosovo statutory 5% when omitted. */
  pensionEmployeeRate?: string;
  pensionEmployerRate?: string;
  /** When false, skips minimum gross enforcement (e.g. unit tests). */
  enforceMinimumGross?: boolean;
}

export interface KosovoPrimaryPayrollFromGrossResult extends CalculateEmployeeLineOutput {
  employerTotalCost: string;
}

/**
 * PRIMARY employer Kosovo employee line: gross → pension → taxable → progressive PIT → net.
 * Uses the same path as production (`calculateEmployeeLine` + legislation snapshot).
 */
export function calculateKosovoPrimaryPayrollFromGross(
  input: KosovoPrimaryPayrollFromGrossInput,
): PayrollCalculationResult<KosovoPrimaryPayrollFromGrossResult> {
  const gross = D(input.grossSalary);
  if (!gross.isFinite() || gross.lte(0)) {
    return {
      ok: false,
      issues: [{ code: "INVALID_GROSS_SALARY", message: "Bruto duhet të jetë një numër > 0." }],
    };
  }

  const snapshot = kosovo2026AtkDefaults({
    pensionEmployeeRate: input.pensionEmployeeRate,
    pensionEmployerRate: input.pensionEmployerRate,
    minimumMonthlyGross: "0",
  });

  const res = calculateEmployeeLine(
    {
      employmentType: "EMPLOYEE",
      employerPrimacy: "PRIMARY",
      hours: { regularHours: "0" },
      rates: { hourlyRate: "1" },
      grossSalaryOverride: roundMoneyEUR(gross).toFixed(2),
      bonusAmount: "0",
      otherDeductions: "0",
      enforceMinimumGross: input.enforceMinimumGross ?? false,
    },
    snapshot,
  );

  if (!res.ok) return res;

  const grossDec = D(res.value.grossSalary);
  const penEr = D(res.value.pensionEmployer);
  const employerTotalCost = roundMoneyEUR(grossDec.plus(penEr)).toFixed(2);

  return {
    ok: true,
    value: {
      ...res.value,
      employerTotalCost,
    },
  };
}
