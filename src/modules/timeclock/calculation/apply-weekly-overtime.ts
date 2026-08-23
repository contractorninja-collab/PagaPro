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
  const weekState = new Map<string, { worked: number; overtime: number }>();

  return ordered.map((day) => {
    // Review days contribute no minutes and must not advance the counter.
    if (day.status !== "OK" || day.workedMinutes === 0) return { ...day };

    const week = isoWeekKey(day.workDateIso);
    const state = weekState.get(week) ?? { worked: 0, overtime: 0 };
    state.worked += day.workedMinutes;
    // The daily rule's overtime counts toward the weekly requirement — the two
    // rules describe the SAME hours, not additive ones. Five 9-hour days is a
    // 45-hour week with five hours of overtime, not ten: the week demands
    // max(0, 45h − 40h) and the daily rule has already supplied all of it.
    state.overtime += day.overtimeMinutes;
    weekState.set(week, state);

    const requiredSoFar = Math.max(0, state.worked - weeklyRegularMinutes);
    const deficit = requiredSoFar - state.overtime;
    const promoted = Math.min(Math.max(0, deficit), day.regularMinutes);
    if (promoted <= 0) return { ...day };

    state.overtime += promoted;
    return {
      ...day,
      regularMinutes: day.regularMinutes - promoted,
      overtimeMinutes: day.overtimeMinutes + promoted,
    };
  });
}
