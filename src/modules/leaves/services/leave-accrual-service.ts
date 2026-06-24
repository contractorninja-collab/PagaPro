import { prisma } from "@/lib/prisma";
import { LEAVE_ENGINE_RULE_VERSION } from "@/modules/leaves/constants/rule-versions";
import { resolveLeavePolicyParameterSet } from "@/modules/leaves/services/leave-policy-service";

function monthEndUtc(year: number, month: number): Date {
  return new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));
}

function monthStartUtc(year: number, month: number): Date {
  return new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
}

/** Idempotent monthly Art 36 posting for one employee (KOSOVO_MONTHLY_LINEAR rate from policy). */
export async function ensureMonthlyLeaveAccrualPosted(params: {
  companyId: string;
  employeeId: string;
  periodYear: number;
  periodMonth: number;
}): Promise<"created" | "skipped_exists" | "skipped_inactive"> {
  const { companyId, employeeId, periodYear, periodMonth } = params;
  if (periodMonth < 1 || periodMonth > 12) return "skipped_inactive";

  const ms = monthStartUtc(periodYear, periodMonth);
  const me = monthEndUtc(periodYear, periodMonth);

  const employee = await prisma.employee.findFirst({
    where: { id: employeeId, companyId },
    select: { hireDate: true, terminationDate: true },
  });
  if (!employee) return "skipped_inactive";
  if (employee.hireDate.getTime() > me.getTime()) return "skipped_inactive";
  if (employee.terminationDate && employee.terminationDate.getTime() < ms.getTime()) {
    return "skipped_inactive";
  }

  const existing = await prisma.leaveAccrualLedger.findFirst({
    where: { companyId, employeeId, periodYear, periodMonth },
    select: { id: true },
  });
  if (existing) return "skipped_exists";

  const policy = await resolveLeavePolicyParameterSet(companyId, me);
  const accruedDays = policy.monthlyAccrualDays;

  await prisma.leaveAccrualLedger.create({
    data: {
      companyId,
      employeeId,
      periodYear,
      periodMonth,
      accruedDays,
      basisJson: {
        model: "KOSOVO_MONTHLY_LINEAR",
        leavePolicyParameterSetId: policy.id,
        periodYear,
        periodMonth,
      },
      ruleVersion: LEAVE_ENGINE_RULE_VERSION,
    },
  });

  return "created";
}

/** Batch helper for cron / admin tools — eligible ACTIVE / ON_LEAVE employees only. */
export async function runMonthlyLeaveAccrualForCompany(params: {
  companyId: string;
  periodYear: number;
  periodMonth: number;
}): Promise<{ created: number; skipped: number }> {
  const employees = await prisma.employee.findMany({
    where: {
      companyId: params.companyId,
      employmentType: "EMPLOYEE",
      status: { in: ["ACTIVE", "ON_LEAVE"] },
    },
    select: { id: true },
    take: 5000,
  });

  let created = 0;
  let skipped = 0;
  for (const e of employees) {
    const r = await ensureMonthlyLeaveAccrualPosted({
      companyId: params.companyId,
      employeeId: e.id,
      periodYear: params.periodYear,
      periodMonth: params.periodMonth,
    });
    if (r === "created") created++;
    else skipped++;
  }

  return { created, skipped };
}
