/**
 * Pure Kosovo-oriented working-day counting for leave (Arts 31, 34).
 * Mon–Fri only; holidays supplied as ISO yyyy-mm-dd set (merged official + company + payroll extras).
 */

import { isoDateUtc } from "@/modules/payroll/calendar/kosovo-public-holidays";

export function utcDateOnly(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 12, 0, 0, 0));
}

/** Inclusive calendar days on UTC civil dates (Art 34 ranges). */
export function countCalendarDaysInclusiveUtc(startDate: Date, endDate: Date): number {
  const s = utcDateOnly(startDate);
  const e = utcDateOnly(endDate);
  if (e.getTime() < s.getTime()) return 0;
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.round((e.getTime() - s.getTime()) / msPerDay) + 1;
}

export interface WorkingDaysEngineResult {
  workingDays: number;
  weekdayHolidayDatesInRange: string[];
  totalHours: string;
}

/**
 * Count working leave days in [startDate, endDate] (UTC date boundaries).
 * Holidays falling on Mon–Fri are excluded from working days and listed for audit (Art 34.1).
 */
export function computeWorkingDaysInRange(
  startDate: Date,
  endDate: Date,
  holidayIsoSet: ReadonlySet<string>,
  hoursPerWorkingDay: number,
): WorkingDaysEngineResult {
  const s = utcDateOnly(startDate);
  const e = utcDateOnly(endDate);
  if (e.getTime() < s.getTime()) {
    return { workingDays: 0, weekdayHolidayDatesInRange: [], totalHours: "0.00" };
  }

  const safeHours = Number.isFinite(hoursPerWorkingDay) && hoursPerWorkingDay > 0 ? hoursPerWorkingDay : 8;

  let workingDays = 0;
  const weekdayHolidayDatesInRange: string[] = [];
  const cur = new Date(s);
  while (cur.getTime() <= e.getTime()) {
    const dow = cur.getUTCDay();
    const iso = isoDateUtc(cur.getUTCFullYear(), cur.getUTCMonth() + 1, cur.getUTCDate());
    if (dow >= 1 && dow <= 5) {
      if (holidayIsoSet.has(iso)) weekdayHolidayDatesInRange.push(iso);
      else workingDays++;
    }
    cur.setUTCDate(cur.getUTCDate() + 1);
  }

  const totalHours = (workingDays * safeHours).toFixed(2);
  return {
    workingDays,
    weekdayHolidayDatesInRange: weekdayHolidayDatesInRange.sort(),
    totalHours,
  };
}
