/**
 * Which days of a payroll month a person was actually employed.
 *
 * Payroll used to answer this from two Employee columns alone — `hireDate` and
 * `terminationDate` — which cannot express a gap. Re-hiring someone clears
 * `terminationDate` and leaves the original `hireDate`, so every month between
 * the old departure and the return looked like ordinary employment and was paid
 * in full. The gap only ever existed in `EmploymentPeriod`, a table nothing read.
 *
 * The window is the intersection of three things, and each one is load-bearing:
 *
 *   1. the employment periods, when the employee has any — this is what makes a
 *      gap visible at all;
 *   2. `[hireDate, terminationDate]` — kept as a ceiling so that a period row
 *      left open by a path that forgot to close it cannot pay a leaver;
 *   3. the payroll month itself.
 *
 * An employee with **no** period rows falls back to (2) alone and therefore
 * behaves exactly as before. That is not a theoretical case: employees created
 * before the table existed have none, and dropping them would silently remove a
 * real person from payroll — a far worse failure than the one being fixed.
 */

export interface EmploymentSpan {
  startedAt: Date;
  endedAt: Date | null;
}

export interface EmploymentWindowInput {
  /** `EmploymentPeriod` rows for this employee. Empty is normal and supported. */
  periods: ReadonlyArray<EmploymentSpan>;
  hireDate: Date;
  terminationDate: Date | null;
  monthStart: Date;
  monthEnd: Date;
}

export interface EmploymentSegment {
  start: Date;
  end: Date;
}

export interface EmploymentWindow {
  /** False means the person was not employed on any day of this month. */
  employed: boolean;
  /** Clipped to the month, ascending, non-overlapping. */
  segments: EmploymentSegment[];
  /** True when the month is only partly worked — a joiner, a leaver, or both. */
  partial: boolean;
}

/** UTC calendar day, so a timestamp's clock time cannot shift a day boundary. */
function dayStart(d: Date): number {
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

function intersect(
  a: { start: number; end: number },
  b: { start: number; end: number },
): { start: number; end: number } | null {
  const start = Math.max(a.start, b.start);
  const end = Math.min(a.end, b.end);
  return start > end ? null : { start, end };
}

export function resolveEmploymentWindow(input: EmploymentWindowInput): EmploymentWindow {
  const month = { start: dayStart(input.monthStart), end: dayStart(input.monthEnd) };

  // The employment record as the Employee row states it — always applied, so a
  // stale open period cannot outlive a recorded termination.
  const recorded = {
    start: dayStart(input.hireDate),
    end: input.terminationDate ? dayStart(input.terminationDate) : Number.POSITIVE_INFINITY,
  };

  const sources: Array<{ start: number; end: number }> =
    input.periods.length > 0
      ? input.periods.map((p) => ({
          start: dayStart(p.startedAt),
          end: p.endedAt ? dayStart(p.endedAt) : Number.POSITIVE_INFINITY,
        }))
      : [recorded];

  const clipped: Array<{ start: number; end: number }> = [];
  for (const span of sources) {
    const withinRecord = intersect(span, recorded);
    if (!withinRecord) continue;
    const withinMonth = intersect(withinRecord, month);
    if (withinMonth) clipped.push(withinMonth);
  }

  clipped.sort((a, b) => a.start - b.start);

  // Merge touching or overlapping spans — a same-day rehire is one stretch of
  // work, not two, and double-counting the boundary day would overpay it.
  const merged: Array<{ start: number; end: number }> = [];
  for (const span of clipped) {
    const last = merged[merged.length - 1];
    if (last && span.start <= last.end + 86_400_000) {
      last.end = Math.max(last.end, span.end);
    } else {
      merged.push({ ...span });
    }
  }

  const segments = merged.map((s) => ({ start: new Date(s.start), end: new Date(s.end) }));
  const coversWholeMonth =
    segments.length === 1 &&
    segments[0]!.start.getTime() <= month.start &&
    segments[0]!.end.getTime() >= month.end;

  return {
    employed: segments.length > 0,
    segments,
    partial: segments.length > 0 && !coversWholeMonth,
  };
}

/**
 * Working days inside the window, counted the same way the full-month figure is.
 *
 * `expectedWorkingDays` for a month excludes weekday public holidays, so a
 * partial window that counted plain weekdays credited a holiday the denominator
 * had already removed — a leaver was paid for a day nobody worked.
 */
export function countWorkingDaysInWindow(
  window: EmploymentWindow,
  holidayIsoDates: ReadonlySet<string>,
): number {
  let total = 0;
  for (const segment of window.segments) {
    const s = dayStart(segment.start);
    const e = dayStart(segment.end);
    for (let t = s; t <= e; t += 86_400_000) {
      const day = new Date(t);
      const dow = day.getUTCDay();
      if (dow === 0 || dow === 6) continue;
      if (holidayIsoDates.has(day.toISOString().slice(0, 10))) continue;
      total += 1;
    }
  }
  return total;
}
