import type { EmployerPrimacy, LegislationSnapshot } from "./types";
import { calculateEmployeeLine } from "./payroll-calculator";
import { D } from "./money/decimal";
import { roundMoneyEUR } from "./money/rounding";

export function solveEquivalentMonthlyGrossForTargetNet(params: {
  targetNet: string;
  snapshot: LegislationSnapshot;
  employerPrimacy: EmployerPrimacy;
  enforceMinimumGross: boolean;
  applyTrust?: boolean;
  applyTax?: boolean;
}): { gross: string } | null {
  const target = D(params.targetNet);
  if (!target.isFinite() || target.lte(0)) return null;

  let lo = D("0");
  let hi = target.mul(5);
  let lastOk: string | null = null;

  for (let i = 0; i < 56; i++) {
    const mid = roundMoneyEUR(lo.plus(hi).div(2));
    const res = calculateEmployeeLine(
      {
        employmentType: "EMPLOYEE",
        employerPrimacy: params.employerPrimacy,
        hours: { regularHours: "0" },
        rates: { hourlyRate: "1" },
        grossSalaryOverride: mid.toFixed(2),
        bonusAmount: "0",
        otherDeductions: "0",
        enforceMinimumGross: params.enforceMinimumGross,
        applyTrust: params.applyTrust,
        applyTax: params.applyTax,
      },
      params.snapshot,
    );

    if (!res.ok) {
      lo = mid;
      continue;
    }

    lastOk = res.value.grossSalary;
    const net = D(res.value.netPay);
    const cmp = net.comparedTo(target);
    if (cmp === 0) return { gross: res.value.grossSalary };
    if (cmp < 0) lo = mid;
    else hi = mid;
  }

  return lastOk ? { gross: lastOk } : null;
}
