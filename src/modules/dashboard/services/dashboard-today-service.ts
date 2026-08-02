import { prisma } from "@/lib/prisma";
import { listOnLeaveToday } from "@/modules/leaves/services/leave-query-service";
import { listCompanyHolidaysDto } from "@/modules/payroll/services/company-holiday-service";
import { isTimeClockEnabled } from "@/modules/timeclock/services/timeclock-entitlement";
import { LEAVE_TYPE_LABELS_SQ } from "@/modules/leaves/helpers/leave-type-metadata";
import { startOfUtcDay, endOfUtcDay } from "../helpers/dashboard-time";
import type { DashboardTodaySlice } from "../types/dashboard-types";

/**
 * "Who is actually here today" — the question the old widget looked like it
 * answered but didn't (it counted leave *decisions* taken today).
 *
 * Presence is derived from the immutable punch log rather than `TimeClockDay`,
 * because the derived day rows are only written when something asks for them;
 * a punch, by contrast, exists the moment someone scans.
 */
export async function loadDashboardToday(companyId: string, now = new Date()): Promise<DashboardTodaySlice> {
  const timeClockEnabled = await isTimeClockEnabled(companyId);
  const todayStart = startOfUtcDay(now);
  const todayEnd = endOfUtcDay(now);

  const [onLeaveRows, punches, needsReview, holidays] = await Promise.all([
    listOnLeaveToday(companyId, now),
    timeClockEnabled
      ? prisma.timeClockPunch.findMany({
          where: { companyId, voidedAt: null, occurredAt: { gte: todayStart, lte: todayEnd } },
          select: { employeeId: true, direction: true, occurredAt: true },
          orderBy: { occurredAt: "asc" },
          take: 1000,
        })
      : Promise.resolve([]),
    timeClockEnabled
      ? prisma.timeClockDay.count({ where: { companyId, status: "NEEDS_REVIEW" } })
      : Promise.resolve(0),
    listCompanyHolidaysDto(companyId, now.getUTCFullYear()),
  ]);

  // Last punch of the day per employee; still "in" if it was an entry.
  const lastDirection = new Map<string, "IN" | "OUT">();
  for (const p of punches) lastDirection.set(p.employeeId, p.direction);
  let clockedIn = 0;
  for (const direction of lastDirection.values()) if (direction === "IN") clockedIn += 1;

  const todayIso = todayStart.toISOString().slice(0, 10);
  const nextHoliday =
    holidays
      .filter((h) => h.isActive && h.observedOn >= todayIso)
      .sort((a, b) => a.observedOn.localeCompare(b.observedOn))[0] ?? null;

  return {
    onLeave: onLeaveRows.slice(0, 8).map((row) => ({
      leaveId: row.id,
      employeeId: row.employeeId,
      employeeName: `${row.employee.firstName} ${row.employee.lastName}`.trim(),
      typeLabel: LEAVE_TYPE_LABELS_SQ[row.type] ?? row.type,
      endDateIso: row.endDate.toISOString(),
    })),
    onLeaveTotal: onLeaveRows.length,
    timeClock: timeClockEnabled
      ? { enabled: true, clockedIn, punchesToday: punches.length, needsReview }
      : null,
    nextHoliday: nextHoliday ? { dateIso: nextHoliday.observedOn, name: nextHoliday.name } : null,
  };
}
