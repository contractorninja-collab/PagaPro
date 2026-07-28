import type { TimeClockDirection } from "@prisma/client";

/**
 * The rules a door kiosk applies to a bare badge scan. Pure so they can be
 * asserted directly — the DB-bound wrapper lives in
 * `services/timeclock-punch-service.ts`.
 */

/** A second trigger of the same badge inside this window is treated as one scan. */
export const DUPLICATE_WINDOW_MS = 60_000;

/**
 * How far back a scan looks to decide whether it is an entry or an exit.
 *
 * Deliberately a rolling window rather than "since local midnight": a night
 * shift starting 21:00 and ending 05:00 crosses midnight, and a midnight
 * boundary would read that clock-out as a second clock-in. 18 hours comfortably
 * spans any lawful shift (Neni 30 requires 12h daily rest) while still letting a
 * forgotten clock-out fall out of range — which leaves an unmatched IN for the
 * classifier to flag as NEEDS_REVIEW rather than silently inventing a pairing.
 */
export const SHIFT_LOOKBACK_MS = 18 * 60 * 60 * 1000;

export interface PunchLike {
  occurredAt: Date;
  direction: TimeClockDirection;
}

/** Nobody presses "in" or "out" at a door — scans simply alternate. */
export function inferDirection(recent: PunchLike[]): TimeClockDirection {
  const last = recent[recent.length - 1];
  return last?.direction === "IN" ? "OUT" : "IN";
}

/** True when a scanner fired twice and must not flip someone straight back out. */
export function isDuplicateScan(recent: PunchLike[], now: Date): boolean {
  const last = recent[recent.length - 1];
  return Boolean(last && now.getTime() - last.occurredAt.getTime() < DUPLICATE_WINDOW_MS);
}

/** Sums paired intervals; a trailing unmatched IN contributes nothing. */
export function pairedMinutes(punches: PunchLike[]): number {
  let total = 0;
  let openIn: Date | null = null;
  for (const punch of punches) {
    if (punch.direction === "IN") {
      openIn = punch.occurredAt;
      continue;
    }
    if (openIn) {
      total += Math.max(0, Math.floor((punch.occurredAt.getTime() - openIn.getTime()) / 60_000));
      openIn = null;
    }
  }
  return total;
}
