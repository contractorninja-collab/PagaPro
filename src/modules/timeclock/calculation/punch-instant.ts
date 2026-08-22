/**
 * Which instant a badge scan actually happened at.
 *
 * A kiosk that lost its network queues scans and drains them when it
 * reconnects. Stamping those with the server's arrival time attributes the
 * whole morning to the moment the wifi came back — hours land on the wrong
 * side of a night-window or day boundary and pay wrongly. The device's own
 * clock is the truth for a queued scan, but only within reason: kiosk clocks
 * drift and get reset, and a punch "from the future" or from last month is a
 * broken clock, not a fact.
 */

/** Oldest a device-reported scan may be and still be believed. */
export const MAX_OFFLINE_PUNCH_AGE_MS = 72 * 60 * 60 * 1000;
/** Small forward skew tolerated before the device clock is distrusted. */
export const MAX_CLOCK_SKEW_AHEAD_MS = 5 * 60 * 1000;

export function resolvePunchInstant(
  now: Date,
  deviceReportedAt: Date | null | undefined,
): { instant: Date; usedDeviceClock: boolean } {
  if (!deviceReportedAt) return { instant: now, usedDeviceClock: false };
  const t = deviceReportedAt.getTime();
  if (!Number.isFinite(t)) return { instant: now, usedDeviceClock: false };
  if (t > now.getTime() + MAX_CLOCK_SKEW_AHEAD_MS) return { instant: now, usedDeviceClock: false };
  if (t < now.getTime() - MAX_OFFLINE_PUNCH_AGE_MS) return { instant: now, usedDeviceClock: false };
  return { instant: deviceReportedAt, usedDeviceClock: true };
}
