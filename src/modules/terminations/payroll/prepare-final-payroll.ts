import { prisma } from "@/lib/prisma";
import {
  createPayrollDraft,
  recalculatePayrollEntriesForEmployees,
} from "@/modules/payroll/services/payroll-period-service";

function monthYearFromDate(d: Date): { year: number; month: number } {
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1 };
}

/**
 * Ensures a DRAFT payroll for the termination month, includes the employee, rebuilds their row
 * with partial-month pro-rata through lastWorkingDay, preserves bonus/advance inputs when present.
 * Does not lock or approve payroll.
 */
export async function prepareTerminationFinalPayroll(params: {
  companyId: string;
  employeeId: string;
  lastWorkingDay: Date;
  actorUserId?: string | null;
}): Promise<{ ok: true; payrollId: string } | { ok: false; error: string }> {
  const { year, month } = monthYearFromDate(params.lastWorkingDay);

  let payroll = await prisma.payroll.findUnique({
    where: {
      companyId_year_month: {
        companyId: params.companyId,
        year,
        month,
      },
    },
  });

  if (!payroll) {
    // No employee list: the termination month's payroll belongs to the whole company.
    // Seeding it with just this employee would pin the month to one person, and a later
    // "Ripëllogarit punonjësit" would then rebuild the payroll with only them in it.
    const created = await createPayrollDraft(params.companyId, year, month, params.actorUserId);
    if (!created.ok) {
      return {
        ok: false,
        error:
          created.code === "DUPLICATE"
            ? "Payroll për këtë muaj ekziston — rifreskoni."
            : created.message ?? "Nuk u krijua payroll-i.",
      };
    }
    payroll = await prisma.payroll.findUniqueOrThrow({ where: { id: created.id } });
  }

  if (payroll.status !== "DRAFT") {
    return {
      ok: false,
      error: "Pagë përfunduese mund të përgatitet vetëm kur payroll-i mujor është në DRAFT.",
    };
  }

  // An empty inclusion list means "every eligible employee", so adding a row here would
  // narrow the payroll to this one person. Only extend a list that already restricts.
  const restricted = await prisma.payrollIncludedEmployee.count({
    where: { payrollId: payroll.id },
  });
  if (restricted > 0) {
    await prisma.payrollIncludedEmployee.upsert({
      where: {
        payrollId_employeeId: { payrollId: payroll.id, employeeId: params.employeeId },
      },
      create: { payrollId: payroll.id, employeeId: params.employeeId },
      update: {},
    });
  }

  const existingEntry = await prisma.payrollEntry.findFirst({
    where: { payrollId: payroll.id, employeeId: params.employeeId },
  });

  const lineOverrides =
    existingEntry != null
      ? {
          [params.employeeId]: {
            bonuses: existingEntry.bonuses.toString(),
            otherDeductions: existingEntry.otherDeductions.toString(),
            salaryAdvanceDeduction: existingEntry.salaryAdvanceDeduction.toString(),
          },
        }
      : undefined;

  const recalc = await recalculatePayrollEntriesForEmployees({
    companyId: params.companyId,
    payrollId: payroll.id,
    employeeIds: [params.employeeId],
    lastWorkingDayByEmployeeId: { [params.employeeId]: params.lastWorkingDay },
    entryStatus: "DRAFT",
    actorUserId: params.actorUserId,
    updatePayrollAggregateMeta: false,
    lineOverridesByEmployeeId: lineOverrides,
  });

  if (!recalc.ok) {
    return { ok: false, error: recalc.error };
  }

  return { ok: true, payrollId: payroll.id };
}
