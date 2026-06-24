import type { EmploymentStatus, EmploymentType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { periodBoundsUtc } from "@/modules/payroll/services/payroll-calendar-service";

const ELIGIBLE_STATUSES: EmploymentStatus[] = ["ACTIVE", "ON_LEAVE"];

/** Employees eligible for monthly payroll (never contractors). */
export async function listEmployeesEligibleForPayrollSelection(
  companyId: string,
  year: number,
  month: number,
): Promise<
  Array<{
    id: string;
    firstName: string;
    lastName: string;
    personalId: string;
    jobTitle: string | null;
    employmentType: EmploymentType;
    status: EmploymentStatus;
    compensationBasis: "GROSS_MONTHLY" | "TARGET_NET_MONTHLY";
    baseSalaryMonthly: string;
    targetNetMonthly: string | null;
  }>
> {
  const { start, end } = periodBoundsUtc(year, month);

  const rows = await prisma.employee.findMany({
    where: {
      companyId,
      employmentType: "EMPLOYEE",
      status: { in: ELIGIBLE_STATUSES },
      hireDate: { lte: end },
      OR: [{ terminationDate: null }, { terminationDate: { gte: start } }],
    },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    select: {
      id: true,
      firstName: true,
      lastName: true,
      personalId: true,
      jobTitle: true,
      employmentType: true,
      status: true,
      compensationBasis: true,
      baseSalaryMonthly: true,
      targetNetMonthly: true,
    },
  });

  return rows.map((e) => ({
    id: e.id,
    firstName: e.firstName,
    lastName: e.lastName,
    personalId: e.personalId,
    jobTitle: e.jobTitle,
    employmentType: e.employmentType,
    status: e.status,
    compensationBasis: e.compensationBasis,
    baseSalaryMonthly: e.baseSalaryMonthly.toString(),
    targetNetMonthly: e.targetNetMonthly?.toString() ?? null,
  }));
}
