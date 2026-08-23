import { prisma } from "@/lib/prisma";
import { D } from "@/modules/payroll/calculation/money/decimal";

/**
 * Per-employee annual figures — the numbers behind the "Vërtetim për tatimin
 * dhe kontributet e mbajtura në burim" every employee is entitled to ask for
 * at year end, and the YTD view an accountant reconciles against.
 *
 * Only finalized periods count: APPROVED, LOCKED or ARCHIVED. A certificate
 * must never carry a figure that a DRAFT recalculation could still change.
 */

const FINAL_STATUSES = ["APPROVED", "LOCKED", "ARCHIVED"] as const;

export interface AnnualStatementMonth {
  month: number;
  gross: string;
  taxableIncome: string;
  pit: string;
  pensionEmployee: string;
  pensionEmployer: string;
  net: string;
}

export interface EmployeeAnnualStatement {
  year: number;
  employee: {
    id: string;
    firstName: string;
    lastName: string;
    personalId: string;
    jobTitle: string | null;
  };
  company: {
    legalName: string;
    tradeName: string | null;
    fiscalNumber: string | null;
    addressLine: string | null;
    city: string | null;
  };
  months: AnnualStatementMonth[];
  totals: {
    gross: string;
    taxableIncome: string;
    pit: string;
    pensionEmployee: string;
    pensionEmployer: string;
    net: string;
  };
}

/** Years this employee has at least one finalized payroll month in. */
export async function listFinalizedPayrollYearsForEmployee(
  companyId: string,
  employeeId: string,
): Promise<number[]> {
  const rows = await prisma.payrollEntry.findMany({
    where: {
      employeeId,
      payroll: { companyId, status: { in: [...FINAL_STATUSES] } },
    },
    select: { payroll: { select: { year: true } } },
    distinct: undefined,
  });
  return [...new Set(rows.map((r) => r.payroll.year))].sort((a, b) => b - a);
}

export async function getEmployeeAnnualStatement(
  companyId: string,
  employeeId: string,
  year: number,
): Promise<EmployeeAnnualStatement | null> {
  const employee = await prisma.employee.findFirst({
    where: { id: employeeId, companyId },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      personalId: true,
      jobTitle: true,
      company: {
        select: {
          legalName: true,
          tradeName: true,
          fiscalNumber: true,
          addressLine: true,
          city: true,
        },
      },
    },
  });
  if (!employee) return null;

  const entries = await prisma.payrollEntry.findMany({
    where: {
      employeeId,
      payroll: { companyId, year, status: { in: [...FINAL_STATUSES] } },
    },
    select: {
      grossSalary: true,
      taxableIncome: true,
      pitWithheld: true,
      pensionEmployee: true,
      pensionEmployer: true,
      netPay: true,
      payroll: { select: { month: true } },
    },
    orderBy: { payroll: { month: "asc" } },
  });
  if (entries.length === 0) return null;

  // One payroll per month is the norm, not a schema guarantee — sum by month.
  const byMonth = new Map<
    number,
    { gross: ReturnType<typeof D>; taxable: ReturnType<typeof D>; pit: ReturnType<typeof D>; pe: ReturnType<typeof D>; pr: ReturnType<typeof D>; net: ReturnType<typeof D> }
  >();
  for (const e of entries) {
    const m = e.payroll.month;
    const acc =
      byMonth.get(m) ??
      { gross: D("0"), taxable: D("0"), pit: D("0"), pe: D("0"), pr: D("0"), net: D("0") };
    acc.gross = acc.gross.plus(D(e.grossSalary.toString()));
    acc.taxable = acc.taxable.plus(D(e.taxableIncome.toString()));
    acc.pit = acc.pit.plus(D(e.pitWithheld.toString()));
    acc.pe = acc.pe.plus(D(e.pensionEmployee.toString()));
    acc.pr = acc.pr.plus(D(e.pensionEmployer.toString()));
    acc.net = acc.net.plus(D(e.netPay.toString()));
    byMonth.set(m, acc);
  }

  const months: AnnualStatementMonth[] = [...byMonth.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([month, v]) => ({
      month,
      gross: v.gross.toFixed(2),
      taxableIncome: v.taxable.toFixed(2),
      pit: v.pit.toFixed(2),
      pensionEmployee: v.pe.toFixed(2),
      pensionEmployer: v.pr.toFixed(2),
      net: v.net.toFixed(2),
    }));

  const sum = (pick: (m: AnnualStatementMonth) => string) =>
    months.reduce((acc, m) => acc.plus(D(pick(m))), D("0")).toFixed(2);

  return {
    year,
    employee: {
      id: employee.id,
      firstName: employee.firstName,
      lastName: employee.lastName,
      personalId: employee.personalId,
      jobTitle: employee.jobTitle,
    },
    company: employee.company,
    months,
    totals: {
      gross: sum((m) => m.gross),
      taxableIncome: sum((m) => m.taxableIncome),
      pit: sum((m) => m.pit),
      pensionEmployee: sum((m) => m.pensionEmployee),
      pensionEmployer: sum((m) => m.pensionEmployer),
      net: sum((m) => m.net),
    },
  };
}
