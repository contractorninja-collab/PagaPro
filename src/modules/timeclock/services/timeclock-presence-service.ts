import { prisma } from "@/lib/prisma";
import { recomputeTimeClockDaysForRange } from "@/modules/timeclock/services/timeclock-day-aggregation-service";
import {
  computeComplianceFlags,
  type ComplianceFlag,
} from "@/modules/timeclock/calculation/compliance-flags";

/**
 * The month view behind /prezenca and the employee profile's Prezenca tab.
 *
 * TimeClockDay rows are written lazily — nothing recomputes them until someone
 * asks — so every read here starts with an idempotent recompute for exactly the
 * employees that have punches in the window. The page then never shows stale
 * derived rows next to fresh punches.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

export interface PresenceDayDto {
  workDateIso: string;
  status: "OK" | "NEEDS_REVIEW";
  workedMinutes: number;
  regularMinutes: number;
  overtimeMinutes: number;
  weekendMinutes: number;
  holidayMinutes: number;
  nightMinutes: number;
  nightStackMinutes: number;
  firstInAtIso: string | null;
  lastOutAtIso: string | null;
  reviewReason: string | null;
}

export interface PresenceEmployeeDto {
  employeeId: string;
  name: string;
  jobTitle: string | null;
  departmentName: string | null;
  days: PresenceDayDto[];
  totals: {
    workedMinutes: number;
    overtimeMinutes: number;
    /** Base night plus stacked night — what Neni 27 asks about. */
    nightMinutes: number;
    reviewDays: number;
  };
  flags: ComplianceFlag[];
}

export interface PresenceExceptionDto {
  employeeId: string;
  employeeName: string;
  workDateIso: string;
  reviewReason: string | null;
  firstInAtIso: string | null;
}

export interface PresenceMonthDto {
  year: number;
  month: number;
  employees: PresenceEmployeeDto[];
  exceptions: PresenceExceptionDto[];
  totals: {
    employees: number;
    workedMinutes: number;
    overtimeMinutes: number;
    reviewDays: number;
  };
}

export function presenceMonthBounds(year: number, month: number): { start: Date; end: Date } {
  return {
    start: new Date(Date.UTC(year, month - 1, 1)),
    end: new Date(Date.UTC(year, month, 0, 23, 59, 59, 999)),
  };
}

/** Employees with at least one live punch touching the month (±1 day for overnight). */
async function employeesWithPunches(companyId: string, start: Date, end: Date): Promise<string[]> {
  const grouped = await prisma.timeClockPunch.groupBy({
    by: ["employeeId"],
    where: {
      companyId,
      voidedAt: null,
      occurredAt: { gte: new Date(start.getTime() - DAY_MS), lte: new Date(end.getTime() + DAY_MS) },
    },
  });
  return grouped.map((g) => g.employeeId);
}

export async function getPresenceMonth(
  companyId: string,
  year: number,
  month: number,
): Promise<PresenceMonthDto> {
  const { start, end } = presenceMonthBounds(year, month);
  const employeeIds = await employeesWithPunches(companyId, start, end);

  const empty: PresenceMonthDto = {
    year,
    month,
    employees: [],
    exceptions: [],
    totals: { employees: 0, workedMinutes: 0, overtimeMinutes: 0, reviewDays: 0 },
  };
  if (employeeIds.length === 0) return empty;

  // Sequential on purpose: each recompute runs its own transaction, and the
  // point of the pass is freshness, not speed — a company has tens of badge
  // users, not thousands.
  const daysByEmployee = new Map<string, PresenceDayDto[]>();
  for (const employeeId of employeeIds) {
    const outcome = await recomputeTimeClockDaysForRange({
      companyId,
      employeeId,
      rangeStart: start,
      rangeEnd: end,
    });
    if (!outcome.ok) continue;
    daysByEmployee.set(
      employeeId,
      outcome.days
        .sort((a, b) => a.workDateIso.localeCompare(b.workDateIso))
        .map((d) => ({
          workDateIso: d.workDateIso,
          status: d.status,
          workedMinutes: d.workedMinutes,
          regularMinutes: d.regularMinutes,
          overtimeMinutes: d.overtimeMinutes,
          weekendMinutes: d.weekendMinutes,
          holidayMinutes: d.holidayMinutes,
          nightMinutes: d.nightMinutes,
          nightStackMinutes: d.nightStackMinutes,
          firstInAtIso: d.firstInAt?.toISOString() ?? null,
          lastOutAtIso: d.lastOutAt?.toISOString() ?? null,
          reviewReason: d.reviewReason,
        })),
    );
  }

  const people = await prisma.employee.findMany({
    where: { id: { in: [...daysByEmployee.keys()] }, companyId },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      jobTitle: true,
      department: { select: { name: true } },
    },
    orderBy: [{ department: { name: "asc" } }, { lastName: "asc" }, { firstName: "asc" }],
  });

  const employees: PresenceEmployeeDto[] = people.map((p) => {
    const days = daysByEmployee.get(p.id) ?? [];
    const totals = {
      workedMinutes: days.reduce((a, d) => a + d.workedMinutes, 0),
      overtimeMinutes: days.reduce((a, d) => a + d.overtimeMinutes, 0),
      nightMinutes: days.reduce((a, d) => a + d.nightMinutes + d.nightStackMinutes, 0),
      reviewDays: days.filter((d) => d.status === "NEEDS_REVIEW").length,
    };
    const flags = computeComplianceFlags(
      days.map((d) => ({
        workDateIso: d.workDateIso,
        workedMinutes: d.workedMinutes,
        overtimeMinutes: d.overtimeMinutes,
        nightMinutes: d.nightMinutes,
        nightStackMinutes: d.nightStackMinutes,
        firstInAt: d.firstInAtIso ? new Date(d.firstInAtIso) : null,
        lastOutAt: d.lastOutAtIso ? new Date(d.lastOutAtIso) : null,
      })),
    );
    return {
      employeeId: p.id,
      name: `${p.firstName} ${p.lastName}`.trim(),
      jobTitle: p.jobTitle,
      departmentName: p.department?.name ?? null,
      days,
      totals,
      flags,
    };
  });

  const exceptions: PresenceExceptionDto[] = employees.flatMap((e) =>
    e.days
      .filter((d) => d.status === "NEEDS_REVIEW")
      .map((d) => ({
        employeeId: e.employeeId,
        employeeName: e.name,
        workDateIso: d.workDateIso,
        reviewReason: d.reviewReason,
        firstInAtIso: d.firstInAtIso,
      })),
  );

  return {
    year,
    month,
    employees,
    exceptions,
    totals: {
      employees: employees.length,
      workedMinutes: employees.reduce((a, e) => a + e.totals.workedMinutes, 0),
      overtimeMinutes: employees.reduce((a, e) => a + e.totals.overtimeMinutes, 0),
      reviewDays: employees.reduce((a, e) => a + e.totals.reviewDays, 0),
    },
  };
}

/** One employee's month — the profile tab's feed, same recompute-then-read. */
export async function getEmployeePresenceMonth(
  companyId: string,
  employeeId: string,
  year: number,
  month: number,
): Promise<PresenceEmployeeDto | null> {
  const full = await getPresenceMonthForEmployees(companyId, year, month, [employeeId]);
  return full.employees[0] ?? null;
}

/** Internal variant scoped to given employees; used by the profile tab. */
async function getPresenceMonthForEmployees(
  companyId: string,
  year: number,
  month: number,
  onlyEmployeeIds: string[],
): Promise<PresenceMonthDto> {
  const all = await getPresenceMonth(companyId, year, month);
  const keep = new Set(onlyEmployeeIds);
  const employees = all.employees.filter((e) => keep.has(e.employeeId));
  return { ...all, employees };
}

export interface PresencePunchDto {
  id: string;
  occurredAtIso: string;
  direction: "IN" | "OUT";
  source: "KIOSK" | "MANUAL";
  note: string | null;
  deviceLabel: string | null;
  voidedAtIso: string | null;
  voidedReason: string | null;
}

/**
 * The punches around one work day, voided ones included — the resolve dialog
 * shows the full audit picture, not a pre-filtered one. The window runs a day
 * each side so an overnight shift's closing punch is visible.
 */
export async function listPunchesAroundDay(
  companyId: string,
  employeeId: string,
  workDateIso: string,
): Promise<PresencePunchDto[]> {
  const dayStart = new Date(`${workDateIso}T00:00:00.000Z`);
  const rows = await prisma.timeClockPunch.findMany({
    where: {
      companyId,
      employeeId,
      occurredAt: {
        gte: new Date(dayStart.getTime() - DAY_MS),
        lte: new Date(dayStart.getTime() + 2 * DAY_MS),
      },
    },
    orderBy: { occurredAt: "asc" },
    select: {
      id: true,
      occurredAt: true,
      direction: true,
      source: true,
      note: true,
      voidedAt: true,
      voidedReason: true,
      device: { select: { label: true } },
    },
  });
  return rows.map((r) => ({
    id: r.id,
    occurredAtIso: r.occurredAt.toISOString(),
    direction: r.direction,
    source: r.source,
    note: r.note,
    deviceLabel: r.device?.label ?? null,
    voidedAtIso: r.voidedAt?.toISOString() ?? null,
    voidedReason: r.voidedReason,
  }));
}
