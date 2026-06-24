/**
 * Payroll calendar — weekday working days Mon–Fri in a calendar month (Europe/Belgrade–aligned UTC dates).
 */

import { isoDateUtc } from "@/modules/payroll/calendar/kosovo-public-holidays";

export function periodMonthUtc(year: number, month: number): { start: Date; end: Date } {
  const start = new Date(Date.UTC(year, month - 1, 1, 12, 0, 0, 0));
  const end = new Date(Date.UTC(year, month, 0, 12, 0, 0, 0));
  return { start, end };
}

export function periodBoundsUtc(year: number, month: number): { start: Date; end: Date } {
  const start = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
  const end = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));
  return { start, end };
}

/** Monday–Friday days strictly inside [monthStart, monthEnd] inclusive on calendar dates. */
export function countWeekdayWorkingDays(year: number, month: number): number {
  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 0));
  let n = 0;
  const cur = new Date(start);
  while (cur <= end) {
    const d = cur.getUTCDay(); // 0 Sun … 6 Sat
    if (d >= 1 && d <= 5) n++;
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return n;
}

/** Default full-time: working_days × hoursPerDay (8). */
export function expectedRegularHoursFromWorkingDays(
  workingDays: number,
  hoursPerDay: number = 8,
): string {
  return (workingDays * hoursPerDay).toFixed(2);
}

export interface PayrollMonthWorkingSplit {
  workingDaysMondayFridayExcludingHolidays: number;
  weekdayPublicHolidayDates: string[];
}

/**
 * Monday–Friday days in month, excluding configured public holidays (ISO `YYYY-MM-DD` on weekdays).
 * Holidays come from DB (`CompanyHoliday`) merged with legacy JSON overrides on `PayrollSettings`.
 */
export function splitPayrollMonthWorkingDays(
  year: number,
  month: number,
  holidayIsoDates: readonly string[],
): PayrollMonthWorkingSplit {
  const holiday = new Set(holidayIsoDates);
  const weekdayPublicHolidayDates: string[] = [];

  const dim = new Date(Date.UTC(year, month, 0)).getUTCDate();
  let wd = 0;

  for (let day = 1; day <= dim; day++) {
    const iso = isoDateUtc(year, month, day);
    const dow = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
    if (dow < 1 || dow > 5) continue;

    if (holiday.has(iso)) {
      weekdayPublicHolidayDates.push(iso);
      continue;
    }
    wd++;
  }

  return {
    workingDaysMondayFridayExcludingHolidays: wd,
    weekdayPublicHolidayDates: weekdayPublicHolidayDates.sort(),
  };
}
