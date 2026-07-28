import { prisma } from "@/lib/prisma";
import { decimalToPlain } from "@/modules/payroll/helpers/money-format";

/**
 * Year-to-date and leave-balance figures for the payslip's context tiles.
 *
 * Both are fetched **per payroll, not per employee** — a 200-person month must
 * not fire 200 queries while rendering 200 PDFs. Callers pull one map up front
 * and read from it inside the render loop.
 */

export interface EmployeeYtdTotals {
  grossSalary: string;
  pensionEmployee: string;
  pitWithheld: string;
  netPay: string;
  /** How many payrolls fed these totals — lets the caller say Jan–Kor honestly. */
  monthsCounted: number;
  /** Earliest month included, so the tile label can name the real range. */
  firstMonth: number;
}

/**
 * Cumulative totals for every employee in a payroll, Jan → `throughMonth`.
 *
 * Only payrolls that have left draft count: a month still being edited is not
 * something to print as a year-to-date figure on a document handed to staff.
 */
export async function getPayrollYtdTotals(params: {
  companyId: string;
  year: number;
  throughMonth: number;
  employeeIds: string[];
}): Promise<Map<string, EmployeeYtdTotals>> {
  const result = new Map<string, EmployeeYtdTotals>();
  if (params.employeeIds.length === 0) return result;

  const entries = await prisma.payrollEntry.findMany({
    where: {
      employeeId: { in: params.employeeIds },
      payroll: {
        companyId: params.companyId,
        year: params.year,
        month: { lte: params.throughMonth },
        status: { in: ["APPROVED", "LOCKED", "ARCHIVED"] },
      },
    },
    select: {
      employeeId: true,
      grossSalary: true,
      pensionEmployee: true,
      pitWithheld: true,
      netPay: true,
      payroll: { select: { month: true } },
    },
  });

  const accumulator = new Map<
    string,
    { gross: number; pension: number; pit: number; net: number; months: Set<number> }
  >();

  for (const entry of entries) {
    const bucket = accumulator.get(entry.employeeId) ?? {
      gross: 0,
      pension: 0,
      pit: 0,
      net: 0,
      months: new Set<number>(),
    };
    bucket.gross += Number(decimalToPlain(entry.grossSalary));
    bucket.pension += Number(decimalToPlain(entry.pensionEmployee));
    bucket.pit += Number(decimalToPlain(entry.pitWithheld));
    bucket.net += Number(decimalToPlain(entry.netPay));
    bucket.months.add(entry.payroll.month);
    accumulator.set(entry.employeeId, bucket);
  }

  for (const [employeeId, bucket] of accumulator) {
    result.set(employeeId, {
      grossSalary: bucket.gross.toFixed(2),
      pensionEmployee: bucket.pension.toFixed(2),
      pitWithheld: bucket.pit.toFixed(2),
      netPay: bucket.net.toFixed(2),
      monthsCounted: bucket.months.size,
      firstMonth: Math.min(...bucket.months),
    });
  }

  return result;
}

/** Remaining annual-leave days per employee, for the PRANIA tile. */
export async function getAnnualLeaveRemaining(params: {
  companyId: string;
  year: number;
  employeeIds: string[];
}): Promise<Map<string, string>> {
  const result = new Map<string, string>();
  if (params.employeeIds.length === 0) return result;

  const balances = await prisma.leaveBalance.findMany({
    where: {
      companyId: params.companyId,
      year: params.year,
      leaveType: "PUSHIM_VJETOR",
      employeeId: { in: params.employeeIds },
    },
    select: { employeeId: true, remainingDays: true },
  });

  for (const balance of balances) {
    result.set(balance.employeeId, decimalToPlain(balance.remainingDays));
  }
  return result;
}
