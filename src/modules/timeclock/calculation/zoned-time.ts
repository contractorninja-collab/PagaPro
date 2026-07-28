/**
 * Local-time helpers for the classifier.
 *
 * Every rule in the Labour Law is expressed in local terms — night is 22:00–06:00
 * *local*, a holiday is a local calendar date, a weekend is a local weekday — while
 * punches are stored in UTC. Kosovo observes DST, so the offset cannot be assumed
 * constant across a shift.
 */

const formatterCache = new Map<string, Intl.DateTimeFormat>();

function partsFormatter(timeZone: string): Intl.DateTimeFormat {
  let formatter = formatterCache.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-GB", {
      timeZone,
      hour12: false,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      weekday: "short",
    });
    formatterCache.set(timeZone, formatter);
  }
  return formatter;
}

export interface ZonedParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  /** 0 = Sunday … 6 = Saturday, matching Date#getUTCDay. */
  weekday: number;
  /** `YYYY-MM-DD` in the target zone. */
  isoDate: string;
}

const WEEKDAY_INDEX: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

export function zonedParts(instant: Date, timeZone: string): ZonedParts {
  const parts = partsFormatter(timeZone).formatToParts(instant);
  const read = (type: Intl.DateTimeFormatPartTypes): string =>
    parts.find((p) => p.type === type)?.value ?? "";

  const year = Number(read("year"));
  const month = Number(read("month"));
  const day = Number(read("day"));
  // 24:00 is how some zones render midnight; normalise it to hour 0.
  const hour = Number(read("hour")) % 24;
  const minute = Number(read("minute"));

  return {
    year,
    month,
    day,
    hour,
    minute,
    weekday: WEEKDAY_INDEX[read("weekday")] ?? 0,
    isoDate: `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
  };
}

/** Minutes the zone is ahead of UTC at this instant (Kosovo: +60 winter, +120 summer). */
export function zoneOffsetMinutes(instant: Date, timeZone: string): number {
  const p = zonedParts(instant, timeZone);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, 0, 0);
  // Seconds are dropped on both sides, so compare on the same minute boundary.
  const flooredInstant = Math.floor(instant.getTime() / 60_000) * 60_000;
  return Math.round((asUtc - flooredInstant) / 60_000);
}

export function isWeekend(weekday: number): boolean {
  return weekday === 0 || weekday === 6;
}

/**
 * Night runs across midnight, so the window is a union of two ranges rather than
 * a simple interval: [nightStart, 24:00) ∪ [00:00, nightEnd).
 */
export function isNightHour(hour: number, nightStartHour: number, nightEndHour: number): boolean {
  if (nightStartHour === nightEndHour) return false;
  if (nightStartHour < nightEndHour) return hour >= nightStartHour && hour < nightEndHour;
  return hour >= nightStartHour || hour < nightEndHour;
}
