/**
 * Pure layout maths for the team wallchart. No DB, no React — everything here
 * is decided from ISO day strings so it can be unit-tested to the column.
 *
 * All dates are UTC calendar days as `YYYY-MM-DD`. Leave rows store UTC
 * midnights, so lexicographic comparison of these strings is date comparison.
 */

export interface WallchartDay {
  iso: string;
  dayOfMonth: number;
  /** 0 = Monday … 6 = Sunday — the week starts on Monday in Kosovo. */
  weekday: number;
  /** False on the lead-in/lead-out days a six-week grid borrows from neighbours. */
  inMonth: boolean;
  isWeekend: boolean;
}

const DAY_MS = 24 * 60 * 60 * 1000;

const iso = (d: Date): string => d.toISOString().slice(0, 10);

/**
 * The 42-day window drawn behind a month: starts the Monday on or before the
 * 1st, always six full weeks. The month view is a slice of this same array, so
 * both views agree about every day they share.
 */
export function buildWallchartDays(year: number, month: number): WallchartDay[] {
  const first = new Date(Date.UTC(year, month - 1, 1));
  const lead = (first.getUTCDay() + 6) % 7;
  const start = new Date(first.getTime() - lead * DAY_MS);

  const days: WallchartDay[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(start.getTime() + i * DAY_MS);
    const weekday = (d.getUTCDay() + 6) % 7;
    days.push({
      iso: iso(d),
      dayOfMonth: d.getUTCDate(),
      weekday,
      inMonth: d.getUTCFullYear() === year && d.getUTCMonth() === month - 1,
      isWeekend: weekday >= 5,
    });
  }
  return days;
}

/** The `[offset, offset+length)` slice of the grid that lies inside the month. */
export function monthSlice(days: WallchartDay[]): { offset: number; length: number } {
  const offset = days.findIndex((d) => d.inMonth);
  const length = days.filter((d) => d.inMonth).length;
  return { offset: Math.max(0, offset), length };
}

export interface WallchartBarInput {
  id: string;
  employeeId: string;
  /** YYYY-MM-DD, inclusive on both ends. */
  startIso: string;
  endIso: string;
}

/**
 * Clamp an absence to the visible days. Returns 0-based column and span, or
 * null when the absence lies entirely outside the window.
 */
export function clampBar(
  bar: { startIso: string; endIso: string },
  days: WallchartDay[],
): { col: number; span: number } | null {
  if (days.length === 0) return null;
  const first = days[0]!.iso;
  const last = days[days.length - 1]!.iso;
  if (bar.endIso < first || bar.startIso > last) return null;

  const startIdx = bar.startIso <= first ? 0 : days.findIndex((d) => d.iso === bar.startIso);
  const endIdx =
    bar.endIso >= last ? days.length - 1 : days.findIndex((d) => d.iso === bar.endIso);
  if (startIdx < 0 || endIdx < 0) return null;
  return { col: startIdx, span: endIdx - startIdx + 1 };
}

/**
 * Assign overlapping bars of one employee to lanes so none draw on top of each
 * other. Overlap within one person is not hypothetical: Art 34.2 sick-during-
 * annual produces a medical absence inside an annual one by design.
 *
 * Greedy first-free-lane over start-sorted intervals — minimal lanes for
 * interval graphs, stable for the common case of zero overlaps (everything in
 * lane 0).
 */
export function assignLanes<T extends { startIso: string; endIso: string }>(
  bars: T[],
): { bar: T; lane: number }[] {
  const sorted = [...bars].sort(
    (a, b) => a.startIso.localeCompare(b.startIso) || a.endIso.localeCompare(b.endIso),
  );
  const laneEnds: string[] = [];
  return sorted.map((bar) => {
    let lane = laneEnds.findIndex((end) => end < bar.startIso);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(bar.endIso);
    } else {
      laneEnds[lane] = bar.endIso;
    }
    return { bar, lane };
  });
}

/**
 * Distinct employees absent per visible day, working days only — weekends and
 * public holidays count nobody, matching how the balance engine counts days.
 * The caller passes only the bars that should count (approved, not pending).
 */
export function countCoverage(
  days: WallchartDay[],
  bars: WallchartBarInput[],
  holidayIsos: ReadonlySet<string>,
): number[] {
  return days.map((day) => {
    if (day.isWeekend || holidayIsos.has(day.iso)) return 0;
    const seen = new Set<string>();
    for (const bar of bars) {
      if (bar.startIso <= day.iso && day.iso <= bar.endIso) seen.add(bar.employeeId);
    }
    return seen.size;
  });
}

/** The busiest visible working day, or null when nobody is out at all. */
export function peakCoverage(
  days: WallchartDay[],
  counts: number[],
): { iso: string; count: number } | null {
  let best: { iso: string; count: number } | null = null;
  for (let i = 0; i < days.length; i++) {
    const count = counts[i] ?? 0;
    if (count > 0 && (best === null || count > best.count)) {
      best = { iso: days[i]!.iso, count };
    }
  }
  return best;
}
