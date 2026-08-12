import { prisma } from "@/lib/prisma";

/**
 * Everything needed to decide a pending leave request, computed for the whole
 * queue at once.
 *
 * The temptation here is to call the validation service per row. That would be
 * one round trip per request on every page render — the module already learned
 * that lesson elsewhere. Instead this issues four set-based queries regardless
 * of queue length: the payroll periods the requests touch, the department
 * headcounts, every overlapping absence across the queue's whole window, and
 * the balances of the people involved. Overlap counting is then in-memory.
 */

export interface LeaveQueueDecision {
  /** Remaining annual days before and after this request is approved. */
  balanceBefore: string | null;
  balanceAfter: string | null;
  goesNegative: boolean;
  /** Colleagues in the same department already approved or pending in this span. */
  departmentOff: number;
  departmentHeadcount: number | null;
  departmentLabel: string | null;
  /** "8/2026" — the payroll period this leave lands in. */
  payrollLabel: string;
  payrollLocked: boolean;
  /** Whole days the request has been waiting for a decision. */
  waitingDays: number;
  severity: "block" | "warn" | "clean";
}

interface QueueRowInput {
  id: string;
  employeeId: string;
  type: string;
  startDateIso: string;
  endDateIso: string;
  workingDays: string | null;
  createdAtIso: string | null;
  balanceOverrideApprovedBy: string | null;
}

/** Payroll periods a range touches — a leave can straddle a month boundary. */
function monthsSpanned(start: Date, end: Date): Array<{ year: number; month: number }> {
  const out: Array<{ year: number; month: number }> = [];
  let y = start.getUTCFullYear();
  let m = start.getUTCMonth() + 1;
  const endY = end.getUTCFullYear();
  const endM = end.getUTCMonth() + 1;
  // Guard against a reversed or absurd range producing an unbounded loop.
  for (let i = 0; i < 24 && (y < endY || (y === endY && m <= endM)); i += 1) {
    out.push({ year: y, month: m });
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }
  return out.length > 0 ? out : [{ year: start.getUTCFullYear(), month: start.getUTCMonth() + 1 }];
}

const LOCKED_PAYROLL_STATUSES = ["APPROVED", "LOCKED", "ARCHIVED"] as const;

export async function buildLeaveQueueDecisions(
  companyId: string,
  rows: QueueRowInput[],
  now = new Date(),
): Promise<Record<string, LeaveQueueDecision>> {
  if (rows.length === 0) return {};

  const parsed = rows.map((r) => ({
    ...r,
    start: new Date(r.startDateIso),
    end: new Date(r.endDateIso),
  }));

  const windowStart = new Date(Math.min(...parsed.map((r) => r.start.getTime())));
  const windowEnd = new Date(Math.max(...parsed.map((r) => r.end.getTime())));
  const employeeIds = [...new Set(parsed.map((r) => r.employeeId))];

  const [payrolls, headcounts, overlapping, balances, people] = await Promise.all([
    prisma.payroll.findMany({
      where: { companyId },
      select: { year: true, month: true, status: true },
    }),
    prisma.employee.groupBy({
      by: ["departmentId"],
      where: { companyId, status: "ACTIVE" },
      _count: { _all: true },
    }),
    // Every absence overlapping the queue's whole window, fetched once.
    prisma.leaveRequest.findMany({
      where: {
        companyId,
        status: { in: ["APPROVED", "PENDING"] },
        startDate: { lte: windowEnd },
        endDate: { gte: windowStart },
      },
      select: {
        id: true,
        employeeId: true,
        startDate: true,
        endDate: true,
        employee: { select: { departmentId: true } },
      },
    }),
    prisma.leaveBalance.findMany({
      where: {
        companyId,
        employeeId: { in: employeeIds },
        year: { in: [...new Set(parsed.map((r) => r.start.getUTCFullYear()))] },
      },
      select: { employeeId: true, leaveType: true, year: true, remainingDays: true },
    }),
    prisma.employee.findMany({
      where: { companyId, id: { in: employeeIds } },
      select: { id: true, departmentId: true, department: { select: { name: true } } },
    }),
  ]);

  const payrollByPeriod = new Map(payrolls.map((p) => [`${p.year}-${p.month}`, p.status]));
  const headcountByDept = new Map(headcounts.map((h) => [h.departmentId ?? "none", h._count._all]));
  const balanceByKey = new Map(
    balances.map((b) => [`${b.employeeId}|${b.leaveType}|${b.year}`, Number(b.remainingDays)]),
  );
  const personById = new Map(people.map((p) => [p.id, p]));

  const decisions: Record<string, LeaveQueueDecision> = {};

  for (const row of parsed) {
    const person = personById.get(row.employeeId);
    const deptKey = person?.departmentId ?? "none";

    // Same department, overlapping days, someone else.
    const departmentOff = overlapping.filter(
      (o) =>
        o.id !== row.id &&
        o.employeeId !== row.employeeId &&
        (o.employee.departmentId ?? "none") === deptKey &&
        o.startDate <= row.end &&
        o.endDate >= row.start,
    ).length;

    const requested = row.workingDays != null ? Number(row.workingDays) : 0;
    const before = balanceByKey.get(
      `${row.employeeId}|${row.type}|${row.start.getUTCFullYear()}`,
    );
    const after = before == null ? null : before - requested;
    const goesNegative = after != null && after < 0;

    // A leave straddling two months is blocked if EITHER period is closed —
    // approving it would silently fail to reach the closed one.
    const months = monthsSpanned(row.start, row.end);
    const lockedMonth = months.find((m) => {
      const status = payrollByPeriod.get(`${m.year}-${m.month}`);
      return status != null && (LOCKED_PAYROLL_STATUSES as readonly string[]).includes(status);
    });
    const label = lockedMonth ?? months[0]!;

    const waitingDays =
      row.createdAtIso != null
        ? Math.max(
            0,
            Math.floor((now.getTime() - new Date(row.createdAtIso).getTime()) / 86_400_000),
          )
        : 0;

    const severity: LeaveQueueDecision["severity"] = lockedMonth
      ? "block"
      : goesNegative || waitingDays > 7
        ? "warn"
        : "clean";

    decisions[row.id] = {
      balanceBefore: before == null ? null : before.toFixed(2),
      balanceAfter: after == null ? null : after.toFixed(2),
      goesNegative,
      departmentOff,
      departmentHeadcount: headcountByDept.get(deptKey) ?? null,
      departmentLabel: person?.department?.name ?? null,
      payrollLabel: `${label.month}/${label.year}`,
      payrollLocked: lockedMonth != null,
      waitingDays,
      severity,
    };
  }

  return decisions;
}
