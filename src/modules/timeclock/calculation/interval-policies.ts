import type { WorkedInterval } from "./types";

/**
 * Company punch policies applied to paired intervals, before the minute walk.
 *
 * Both are OFF by default. Both are pure and run inside classifyDay, so the
 * weekly-overtime pass and the payroll sync see policy-adjusted minutes with
 * no further wiring.
 */

const MINUTE_MS = 60_000;

/**
 * Rounds each interval boundary to the NEAREST multiple of `roundToMinutes`.
 *
 * Symmetric on purpose: the tempting employer-friendly rule (round IN up,
 * OUT down) clips a minute or two off every single punch, which summed over a
 * year is systematic underpayment of time actually worked — precisely what
 * Neni 55 does not allow. Nearest-N is neutral: 07:56 becomes 08:00, but
 * 08:07 becomes 08:00 too, and over many punches it averages out.
 *
 * Only 5/10/15 are accepted (enforced in the save action): Kosovo's UTC
 * offsets are whole hours, so epoch-minute rounding equals wall-clock
 * rounding for those grids. An interval that collapses to nothing is dropped.
 */
export function roundIntervals(
  intervals: readonly WorkedInterval[],
  roundToMinutes: number,
): WorkedInterval[] {
  if (!Number.isInteger(roundToMinutes) || roundToMinutes <= 1) return [...intervals];
  const grid = roundToMinutes * MINUTE_MS;
  const nearest = (d: Date) => new Date(Math.round(d.getTime() / grid) * grid);

  return intervals
    .map((iv) => ({ start: nearest(iv.start), end: nearest(iv.end) }))
    .filter((iv) => iv.end.getTime() > iv.start.getTime());
}

/**
 * Deducts an unpaid break from the middle of the day's interval.
 *
 * Applies ONLY when the day is one continuous interval: an employee who
 * badges out for lunch is already unpaid for the gap, and deducting again on
 * top of that would take the same break twice. And only when the interval
 * exceeds the threshold — a short day had no lunch in it to deduct.
 *
 * The gap is cut from the MIDDLE, not the end: night and weekend windows are
 * evaluated per minute, so trimming the end of a late shift would delete its
 * best-paid minutes rather than the midday ones a lunch actually occupies.
 *
 * Legal note carried from the schema: Neni 64's 30-minute daily break is part
 * of PAID working time. This policy exists for additional unpaid meal breaks
 * a company's contracts define — it must not be used to unpay the statutory
 * break.
 */
export function applyBreakDeduction(
  intervals: readonly WorkedInterval[],
  deductMinutes: number,
  thresholdMinutes: number,
): WorkedInterval[] {
  if (!Number.isInteger(deductMinutes) || deductMinutes <= 0) return [...intervals];
  if (intervals.length !== 1) return [...intervals];

  const only = intervals[0]!;
  const lengthMinutes = (only.end.getTime() - only.start.getTime()) / MINUTE_MS;
  if (lengthMinutes <= thresholdMinutes) return [...intervals];
  if (lengthMinutes <= deductMinutes) return [...intervals];

  const midMs =
    Math.round((only.start.getTime() + only.end.getTime()) / 2 / MINUTE_MS) * MINUTE_MS;
  const half = Math.floor(deductMinutes / 2) * MINUTE_MS;
  const gapStart = new Date(midMs - half);
  const gapEnd = new Date(gapStart.getTime() + deductMinutes * MINUTE_MS);

  return [
    { start: only.start, end: gapStart },
    { start: gapEnd, end: only.end },
  ].filter((iv) => iv.end.getTime() > iv.start.getTime());
}
