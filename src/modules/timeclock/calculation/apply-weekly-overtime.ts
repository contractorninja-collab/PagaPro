import type { ClassifiedDay } from "./types";

/**
 * Weekly overtime (Neni 23: the working week is 40 hours).
 *
 * The per-day classifier only knows its own day, so six seven-hour days —
 * 42 hours, no day over eight — produced zero overtime. This pass runs over a
 * whole local week and promotes the minutes worked beyond the weekly norm
 * from `regular` to `overtime`, attributed to the days on which the norm was
 * actually crossed.
 *
 * Only plain regular minutes are promoted. Weekend, holiday and night minutes
 * already carry their own premium as base — promoting them would change which
 * premium they earn, which is a different (and rarer) policy question than
 * the one this solves. All worked minutes COUNT toward the norm either way.
 *
 * Pure: takes classified days, returns new objects, mutates nothing.
 */

/** Monday-based week key for a `YYYY-MM-DD` local date. */
export function isoWeekKey(workDateIso: string): string {
  const [y, m, d] = workDateIso.split("-").map(Number);
  const utc = new Date(Date.UTC(y!, m! - 1, d!));
  const daysBackToMonday = (utc.getUTCDay() + 6) % 7;
  utc.setUTCDate(utc.getUTCDate() - daysBackToMonday);
  return utc.toISOString().slice(0, 10);
}

export function applyWeeklyOvertime(
  days: readonly ClassifiedDay[],
  weeklyRegularMinutes: number,
): ClassifiedDay[] {
  if (!Number.isFinite(weeklyRegularMinutes) || weeklyRegularMinutes <= 0) {
    return [...days];
  }

  const ordered = [...days].sort((a, b) => a.workDateIso.localeCompare(b.workDateIso));
  const cumulativeByWeek = new Map<string, number>();

  return ordered.map((day) => {
    // Review days contribute no minutes and must not advance the counter.
    if (day.status !== "OK" || day.workedMinutes === 0) return { ...day };

    const week = isoWeekKey(day.workDateIso);
    const before = cumulativeByWeek.get(week) ?? 0;
    const after = before + day.workedMinutes;
    cumulativeByWeek.set(week, after);

    const overflowInDay =
      Math.max(0, after - weeklyRegularMinutes) - Math.max(0, before - weeklyRegularMinutes);
    const promoted = Math.min(day.regularMinutes, overflowInDay);
    if (promoted <= 0) return { ...day };

    return {
      ...day,
      regularMinutes: day.regularMinutes - promoted,
      overtimeMinutes: day.overtimeMinutes + promoted,
    };
  });
}
