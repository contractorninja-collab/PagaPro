import type { EmploymentStatus, EmploymentType, LeaveType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { payrollMonthNameSq } from "@/modules/payroll/helpers/month-label";
import { CONTRACT_TERM_LABELS } from "@/modules/annex/types";

/**
 * Aggregate queries behind `/raportet`.
 *
 * Everything returns plain numbers, not Decimal and not strings. The old report
 * fetchers stringified every figure for the spreadsheet exporters, which meant
 * nothing could feed a chart without being parsed back — so the numbers are
 * converted here, once, at the edge of the database.
 *
 * Money is summed by Postgres and converted with `toNumber()`. That is safe for
 * display: these are already-rounded 2dp euro values being read, never re-derived
 * — the payroll engine remains the only place money is computed, in decimal.js.
 */

type DecimalLike = { toNumber(): number } | null | undefined;

const num = (d: DecimalLike): number => (d ? d.toNumber() : 0);
const round2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;

/** `2026-07` — sorts lexicographically, which is what the month roll-ups need. */
function monthKey(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, "0")}`;
}

/** `Kor 26` — short enough for a 12-point x-axis on a phone. */
function shortMonthLabel(year: number, month: number): string {
  return `${payrollMonthNameSq(month).slice(0, 3)} ${String(year).slice(2)}`;
}

/**
 * January–December of `year`.
 *
 * The whole page is scoped by one year selector, so every series shares an
 * x-axis. A rolling twelve-month window would read differently in each section
 * and would be wrong outright for a past year.
 */
function monthsOfYear(year: number): { year: number; month: number }[] {
  return Array.from({ length: 12 }, (_, i) => ({ year, month: i + 1 }));
}

/**
 * The years worth offering in the selector, newest first.
 *
 * Drawn from what actually exists — payroll periods and leave balances — plus
 * the current year, so a company on its first day still has something to pick.
 */
export async function reportingYears(companyId: string, currentYear: number): Promise<number[]> {
  const [payrollYears, balanceYears] = await Promise.all([
    prisma.payroll.findMany({
      where: { companyId },
      select: { year: true },
      distinct: ["year"],
      orderBy: { year: "desc" },
      take: 20,
    }),
    prisma.leaveBalance.findMany({
      where: { companyId },
      select: { year: true },
      distinct: ["year"],
      orderBy: { year: "desc" },
      take: 20,
    }),
  ]);

  const set = new Set<number>([currentYear]);
  for (const p of payrollYears) set.add(p.year);
  for (const b of balanceYears) set.add(b.year);
  return [...set].sort((a, b) => b - a);
}

// ---------------------------------------------------------------------------
// 1 — Kostoja e pagave
// ---------------------------------------------------------------------------

export interface PayrollCostPoint {
  key: string;
  label: string;
  year: number;
  month: number;
  gross: number;
  net: number;
  employerCost: number;
  /** Employer-side burden: total cost minus gross. */
  employerBurden: number;
  pit: number;
  pensionEmployee: number;
  pensionEmployer: number;
  employees: number;
  /** DRAFT payrolls are still being edited — the chart says so rather than hiding them. */
  isDraft: boolean;
}

/**
 * Gross / net / employer total cost per payroll period of one year, January first.
 *
 * Months with no payroll are simply absent — drawing them as zero would read as
 * "we paid nobody" rather than "nothing has been run yet".
 *
 * One payroll per (year, month) is the norm but not a schema guarantee, so
 * periods sharing a month are summed together.
 */
export async function payrollCostSeries(
  companyId: string,
  year: number,
): Promise<PayrollCostPoint[]> {
  const payrolls = await prisma.payroll.findMany({
    where: { companyId, year },
    select: { id: true, year: true, month: true, status: true },
    orderBy: [{ month: "asc" }],
    take: 60,
  });
  if (payrolls.length === 0) return [];

  const totals = await prisma.payrollEntry.groupBy({
    by: ["payrollId"],
    where: { payrollId: { in: payrolls.map((p) => p.id) } },
    _sum: {
      grossSalary: true,
      netPay: true,
      employerTotalCost: true,
      pitWithheld: true,
      pensionEmployee: true,
      pensionEmployer: true,
    },
    _count: { _all: true },
  });
  const byPayroll = new Map(totals.map((t) => [t.payrollId, t]));

  const merged = new Map<string, PayrollCostPoint>();
  for (const p of payrolls) {
    const t = byPayroll.get(p.id);
    const key = monthKey(p.year, p.month);
    const point =
      merged.get(key) ??
      ({
        key,
        label: shortMonthLabel(p.year, p.month),
        year: p.year,
        month: p.month,
        gross: 0,
        net: 0,
        employerCost: 0,
        employerBurden: 0,
        pit: 0,
        pensionEmployee: 0,
        pensionEmployer: 0,
        employees: 0,
        isDraft: false,
      } satisfies PayrollCostPoint);

    point.gross += num(t?._sum.grossSalary);
    point.net += num(t?._sum.netPay);
    point.employerCost += num(t?._sum.employerTotalCost);
    point.pit += num(t?._sum.pitWithheld);
    point.pensionEmployee += num(t?._sum.pensionEmployee);
    point.pensionEmployer += num(t?._sum.pensionEmployer);
    point.employees += t?._count._all ?? 0;
    if (p.status === "DRAFT") point.isDraft = true;
    merged.set(key, point);
  }

  return [...merged.values()]
    .sort((a, b) => a.key.localeCompare(b.key))
    .map((p) => ({
      ...p,
      gross: round2(p.gross),
      net: round2(p.net),
      employerCost: round2(p.employerCost),
      employerBurden: round2(Math.max(0, p.employerCost - p.gross)),
      pit: round2(p.pit),
      pensionEmployee: round2(p.pensionEmployee),
      pensionEmployer: round2(p.pensionEmployer),
    }));
}

// ---------------------------------------------------------------------------
// 2 — Fuqia punëtore
// ---------------------------------------------------------------------------

export interface WorkforceSlice {
  key: string;
  label: string;
  count: number;
}

export interface WorkforceMovementPoint {
  key: string;
  label: string;
  joiners: number;
  leavers: number;
  /** Joiners minus leavers — the number a headcount plan is actually about. */
  net: number;
}

export interface WorkforceShape {
  /** Everyone not TERMINATED, as of now — not as of the selected year. */
  headcount: number;
  byDepartment: WorkforceSlice[];
  byStatus: WorkforceSlice[];
  byContractType: WorkforceSlice[];
  byEmploymentType: WorkforceSlice[];
  movement: WorkforceMovementPoint[];
}

const STATUS_LABELS_SQ: Record<EmploymentStatus, string> = {
  ACTIVE: "Aktiv",
  INACTIVE: "Jo aktiv",
  ON_LEAVE: "Në pushim",
  SUSPENDED: "I pezulluar",
  TERMINATED: "I larguar",
};

const EMPLOYMENT_TYPE_LABELS_SQ: Record<EmploymentType, string> = {
  EMPLOYEE: "I punësuar",
  CONTRACTOR: "Kontraktor",
};

/**
 * Headcount shape now, plus joiners and leavers month by month across `year`.
 *
 * The distributions count everyone who has not left; movement is a roll-up over
 * `hireDate` and `terminationDate`, which nothing in the app computed before.
 */
export async function workforceShape(companyId: string, year: number): Promise<WorkforceShape> {
  const window = monthsOfYear(year);
  const windowStart = new Date(Date.UTC(year, 0, 1));
  const windowEnd = new Date(Date.UTC(year, 11, 31, 23, 59, 59, 999));

  const currentWhere = { companyId, status: { not: "TERMINATED" as const } };

  const [byStatusRaw, byContractRaw, byEmploymentRaw, byDeptRaw, departments, hires, exits] =
    await Promise.all([
      prisma.employee.groupBy({
        by: ["status"],
        where: { companyId },
        _count: { _all: true },
      }),
      prisma.employee.groupBy({
        by: ["contractType"],
        where: currentWhere,
        _count: { _all: true },
      }),
      prisma.employee.groupBy({
        by: ["employmentType"],
        where: currentWhere,
        _count: { _all: true },
      }),
      prisma.employee.groupBy({
        by: ["departmentId"],
        where: currentWhere,
        _count: { _all: true },
      }),
      prisma.department.findMany({
        where: { companyId },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      }),
      prisma.employee.findMany({
        where: { companyId, hireDate: { gte: windowStart, lte: windowEnd } },
        select: { hireDate: true },
        take: 5000,
      }),
      prisma.employee.findMany({
        where: { companyId, terminationDate: { gte: windowStart, lte: windowEnd } },
        select: { terminationDate: true },
        take: 5000,
      }),
    ]);

  const deptNames = new Map(departments.map((d) => [d.id, d.name]));

  const byDepartment = byDeptRaw
    .map((r) => ({
      key: r.departmentId ?? "none",
      label: r.departmentId ? (deptNames.get(r.departmentId) ?? "Departament i fshirë") : "Pa departament",
      count: r._count._all,
    }))
    .sort((a, b) => b.count - a.count);

  const byStatus = byStatusRaw
    .map((r) => ({ key: r.status, label: STATUS_LABELS_SQ[r.status], count: r._count._all }))
    .sort((a, b) => b.count - a.count);

  const byContractType = byContractRaw
    .map((r) => ({
      key: r.contractType,
      label: CONTRACT_TERM_LABELS[r.contractType],
      count: r._count._all,
    }))
    .sort((a, b) => b.count - a.count);

  const byEmploymentType = byEmploymentRaw
    .map((r) => ({
      key: r.employmentType,
      label: EMPLOYMENT_TYPE_LABELS_SQ[r.employmentType],
      count: r._count._all,
    }))
    .sort((a, b) => b.count - a.count);

  const movement = window.map((m) => ({
    key: monthKey(m.year, m.month),
    label: shortMonthLabel(m.year, m.month),
    joiners: 0,
    leavers: 0,
    net: 0,
  }));
  const movementIndex = new Map(movement.map((m) => [m.key, m]));

  for (const h of hires) {
    const k = monthKey(h.hireDate.getUTCFullYear(), h.hireDate.getUTCMonth() + 1);
    const slot = movementIndex.get(k);
    if (slot) slot.joiners += 1;
  }
  for (const e of exits) {
    if (!e.terminationDate) continue;
    const k = monthKey(e.terminationDate.getUTCFullYear(), e.terminationDate.getUTCMonth() + 1);
    const slot = movementIndex.get(k);
    if (slot) slot.leavers += 1;
  }
  for (const m of movement) m.net = m.joiners - m.leavers;

  return {
    headcount: byDepartment.reduce((sum, d) => sum + d.count, 0),
    byDepartment,
    byStatus,
    byContractType,
    byEmploymentType,
    movement,
  };
}

// ---------------------------------------------------------------------------
// 3 — Presioni i pushimeve
// ---------------------------------------------------------------------------

export interface LeavePressureBucket {
  key: string;
  label: string;
  count: number;
}

export interface CarryAtRiskRow {
  employeeId: string;
  employeeName: string;
  departmentName: string | null;
  carryDays: number;
  remainingDays: number;
  expiresIso: string | null;
}

export interface LeaveMonthPoint {
  key: string;
  label: string;
  /** Working days of approved leave starting in this month. */
  days: number;
  requests: number;
}

export interface LeavePressure {
  year: number;
  quota: number;
  used: number;
  remaining: number;
  pending: number;
  employees: number;
  /** How the workforce is distributed across "how much is left", for a stacked bar. */
  buckets: LeavePressureBucket[];
  carryAtRisk: CarryAtRiskRow[];
  byMonth: LeaveMonthPoint[];
  byType: LeavePressureBucket[];
}

const LEAVE_TYPE_LABELS_SQ: Record<LeaveType, string> = {
  PUSHIM_VJETOR: "Vjetor",
  PUSHIM_MJEKESOR: "Mjekësor",
  PUSHIM_PERSONAL: "Personal",
  PUSHIM_LEHONIE: "Lehoni",
  PUSHIM_PA_PAGESE: "Pa pagesë",
  TJETER: "Tjetër",
};

/**
 * Annual leave used against what is left, who loses carry-over on 30 June, and
 * when absence actually lands.
 *
 * Carry-over expiry is read from `carryExpiresAt` rather than assumed — the
 * balance engine already wrote the date it enforces.
 */
export async function leavePressure(companyId: string, year: number): Promise<LeavePressure> {
  const yearStart = new Date(Date.UTC(year, 0, 1));
  const yearEnd = new Date(Date.UTC(year, 11, 31, 23, 59, 59, 999));

  const [balances, approved] = await Promise.all([
    prisma.leaveBalance.findMany({
      where: { companyId, year, leaveType: "PUSHIM_VJETOR" },
      select: {
        employeeId: true,
        yearlyQuota: true,
        usedDays: true,
        pendingDays: true,
        remainingDays: true,
        carryOverDays: true,
        carryExpiresAt: true,
        employee: {
          select: { firstName: true, lastName: true, department: { select: { name: true } } },
        },
      },
      take: 2000,
    }),
    prisma.leaveRequest.findMany({
      where: {
        companyId,
        status: "APPROVED",
        startDate: { gte: yearStart, lte: yearEnd },
      },
      select: { type: true, startDate: true, workingDays: true, totalDays: true },
      take: 5000,
    }),
  ]);

  let quota = 0;
  let used = 0;
  let remaining = 0;
  let pending = 0;
  const buckets = { negative: 0, low: 0, healthy: 0, unused: 0 };
  const carryAtRisk: CarryAtRiskRow[] = [];

  for (const b of balances) {
    const q = num(b.yearlyQuota);
    const u = num(b.usedDays);
    const r = num(b.remainingDays);
    quota += q;
    used += u;
    remaining += r;
    pending += num(b.pendingDays);

    if (r < 0) buckets.negative += 1;
    else if (q > 0 && u / q >= 0.85) buckets.low += 1;
    else if (u === 0) buckets.unused += 1;
    else buckets.healthy += 1;

    const carry = num(b.carryOverDays);
    if (carry > 0 && r > 0) {
      carryAtRisk.push({
        employeeId: b.employeeId,
        employeeName: `${b.employee.firstName} ${b.employee.lastName}`.trim(),
        departmentName: b.employee.department?.name ?? null,
        carryDays: round2(carry),
        remainingDays: round2(r),
        expiresIso: b.carryExpiresAt ? b.carryExpiresAt.toISOString() : null,
      });
    }
  }

  const byMonth: LeaveMonthPoint[] = Array.from({ length: 12 }, (_, i) => ({
    key: monthKey(year, i + 1),
    label: payrollMonthNameSq(i + 1).slice(0, 3),
    days: 0,
    requests: 0,
  }));
  const typeCounts = new Map<LeaveType, number>();

  for (const r of approved) {
    const slot = byMonth[r.startDate.getUTCMonth()];
    if (slot) {
      slot.days += num(r.workingDays) || num(r.totalDays);
      slot.requests += 1;
    }
    typeCounts.set(r.type, (typeCounts.get(r.type) ?? 0) + 1);
  }
  for (const m of byMonth) m.days = round2(m.days);

  return {
    year,
    quota: round2(quota),
    used: round2(used),
    remaining: round2(remaining),
    pending: round2(pending),
    employees: balances.length,
    buckets: [
      { key: "negative", label: "Tejkalim", count: buckets.negative },
      { key: "low", label: "Pak i mbetur", count: buckets.low },
      { key: "healthy", label: "Në rregull", count: buckets.healthy },
      { key: "unused", label: "Pa përdorur", count: buckets.unused },
    ],
    carryAtRisk: carryAtRisk.sort((a, b) => b.carryDays - a.carryDays).slice(0, 12),
    byMonth,
    byType: [...typeCounts.entries()]
      .map(([type, count]) => ({ key: type, label: LEAVE_TYPE_LABELS_SQ[type], count }))
      .sort((a, b) => b.count - a.count),
  };
}
