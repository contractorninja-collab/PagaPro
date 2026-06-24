import type { PayrollPeriodStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/** Unified row for payroll-derived reports (live entries or locked snapshot). */
export type PayrollReportRow = {
  employeeId: string;
  employeeName: string;
  personalId: string;
  employmentTypeSnapshot: string;
  grossSalary: string;
  netPay: string;
  taxableIncome: string;
  pitWithheld: string;
  pensionEmployee: string;
  pensionEmployer: string;
  bonuses: string;
  otherDeductions: string;
  salaryAdvanceDeduction: string;
  otherEmployerCosts: string;
  employerTotalCost: string;
  applyTrust: boolean;
  applyTax: boolean;
  adjustmentsJson: string;
  breakdownJson: string;
};

type SnapshotEntry = {
  employeeId: string;
  name: string;
  personalId: string;
  grossSalary: string;
  netPay: string;
  taxableIncome: string;
  pitWithheld: string;
  pensionEmployee: string;
  pensionEmployer: string;
  bonuses: string;
  otherDeductions: string;
  adjustments?: { kind: string; label: string; amount: string }[];
  breakdown?: unknown;
};

function rowFromSnapshot(e: SnapshotEntry, empTrustTax: Map<string, { trust: boolean; tax: boolean }>): PayrollReportRow {
  const tt = empTrustTax.get(e.employeeId);
  return {
    employeeId: e.employeeId,
    employeeName: e.name,
    personalId: e.personalId,
    employmentTypeSnapshot: "",
    grossSalary: e.grossSalary,
    netPay: e.netPay,
    taxableIncome: e.taxableIncome,
    pitWithheld: e.pitWithheld,
    pensionEmployee: e.pensionEmployee,
    pensionEmployer: e.pensionEmployer,
    bonuses: e.bonuses,
    otherDeductions: e.otherDeductions,
    salaryAdvanceDeduction: "",
    otherEmployerCosts: "",
    employerTotalCost: "",
    applyTrust: tt?.trust ?? true,
    applyTax: tt?.tax ?? true,
    adjustmentsJson: JSON.stringify(e.adjustments ?? []),
    breakdownJson: typeof e.breakdown === "object" ? JSON.stringify(e.breakdown) : String(e.breakdown ?? ""),
  };
}

function usesSnapshot(status: PayrollPeriodStatus): boolean {
  return status === "LOCKED" || status === "ARCHIVED";
}

export async function resolvePayrollPeriodRows(
  companyId: string,
  payrollId: string,
): Promise<{ payrollYear: number; payrollMonth: number; currency: string; rows: PayrollReportRow[] }> {
  const payroll = await prisma.payroll.findFirst({
    where: { id: payrollId, companyId },
    include: {
      snapshot: true,
      entries: {
        include: {
          adjustments: true,
          employee: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              personalId: true,
              applyTrust: true,
              applyTax: true,
            },
          },
        },
        orderBy: [{ employee: { lastName: "asc" } }, { employee: { firstName: "asc" } }],
      },
    },
  });

  if (!payroll) {
    throw new Error("Periudha e pagës nuk u gjet.");
  }

  if (usesSnapshot(payroll.status)) {
    const snap = payroll.snapshot;
    if (!snap?.payload || typeof snap.payload !== "object") {
      throw new Error("Payroll i kyçur nuk ka snapshot — raporti nuk mund të gjenerohet.");
    }
    const payload = snap.payload as {
      payroll?: { year?: number; month?: number; currency?: string };
      entries?: SnapshotEntry[];
    };
    const entries = payload.entries ?? [];
    const empTrustTax = new Map<string, { trust: boolean; tax: boolean }>();
    for (const en of payroll.entries) {
      empTrustTax.set(en.employeeId, { trust: en.employee.applyTrust, tax: en.employee.applyTax });
    }
    const rows = entries.map((e) => rowFromSnapshot(e, empTrustTax));
    return {
      payrollYear: payload.payroll?.year ?? payroll.year,
      payrollMonth: payload.payroll?.month ?? payroll.month,
      currency: payload.payroll?.currency ?? payroll.currency,
      rows,
    };
  }

  const rows: PayrollReportRow[] = payroll.entries.map((e) => ({
    employeeId: e.employeeId,
    employeeName: `${e.employee.firstName} ${e.employee.lastName}`,
    personalId: e.employee.personalId,
    employmentTypeSnapshot: e.employmentTypeSnapshot,
    grossSalary: e.grossSalary.toString(),
    netPay: e.netPay.toString(),
    taxableIncome: e.taxableIncome.toString(),
    pitWithheld: e.pitWithheld.toString(),
    pensionEmployee: e.pensionEmployee.toString(),
    pensionEmployer: e.pensionEmployer.toString(),
    bonuses: e.bonuses.toString(),
    otherDeductions: e.otherDeductions.toString(),
    salaryAdvanceDeduction: e.salaryAdvanceDeduction.toString(),
    otherEmployerCosts: e.otherEmployerCosts.toString(),
    employerTotalCost: e.employerTotalCost.toString(),
    applyTrust: e.employee.applyTrust,
    applyTax: e.employee.applyTax,
    adjustmentsJson: JSON.stringify(
      e.adjustments?.map((a) => ({ kind: a.kind, label: a.label, amount: a.amount.toString() })) ?? [],
    ),
    breakdownJson: e.calculationBreakdown ? JSON.stringify(e.calculationBreakdown) : "",
  }));

  return {
    payrollYear: payroll.year,
    payrollMonth: payroll.month,
    currency: payroll.currency,
    rows,
  };
}
