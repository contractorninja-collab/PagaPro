import type {
  ClassifiedDay,
  ClassifierPunch,
  ClassifierRules,
  WorkedInterval,
} from "./types";
import { isNightHour, isWeekend, zonedParts, zoneOffsetMinutes } from "./zoned-time";

const MINUTE_MS = 60_000;

/**
 * Pairs a day's punches into worked intervals.
 *
 * An IN with no matching OUT is not guessed at — the caller marks the day for
 * review and pays nothing. Inventing a clock-out would put unverified hours into
 * someone's salary, which is the one failure mode a time clock must not have.
 */
export function pairPunches(punches: readonly ClassifierPunch[]): {
  intervals: WorkedInterval[];
  unpairedIn: boolean;
  strayOut: boolean;
} {
  const ordered = [...punches].sort((a, b) => a.occurredAt.getTime() - b.occurredAt.getTime());
  const intervals: WorkedInterval[] = [];
  let openIn: Date | null = null;
  let strayOut = false;

  for (const punch of ordered) {
    if (punch.direction === "IN") {
      // Two INs in a row: the first is unpaired, keep the later one.
      if (openIn) strayOut = true;
      openIn = punch.occurredAt;
      continue;
    }
    if (!openIn) {
      strayOut = true;
      continue;
    }
    if (punch.occurredAt.getTime() > openIn.getTime()) {
      intervals.push({ start: openIn, end: punch.occurredAt });
    }
    openIn = null;
  }

  return { intervals, unpairedIn: openIn !== null, strayOut };
}

interface MinuteFacts {
  isHoliday: boolean;
  isWeekend: boolean;
  isNight: boolean;
}

function factsForMinute(instant: Date, rules: ClassifierRules): MinuteFacts {
  const parts = zonedParts(instant, rules.timeZone);
  return {
    isHoliday: rules.holidayIsoDates.has(parts.isoDate),
    isWeekend: isWeekend(parts.weekday),
    isNight: isNightHour(parts.hour, rules.nightStartHour, rules.nightEndHour),
  };
}

/**
 * Splits worked time into pay buckets.
 *
 * Each minute is paid once at its best base rate — holiday and weekend outrank
 * overtime, which outranks a plain night, which outranks ordinary time — and any
 * further premium it also qualifies for is added as an uplift. So an hour is
 * base + every applicable premium, never the same premium twice:
 *
 *   Monday 10:00            regular                     1.0×
 *   Monday 23:00            night                       1.3×
 *   Monday 10th hour        overtime                    1.3×
 *   Sunday 10:00            weekend                     1.5×
 *   Sunday 23:00            weekend + night uplift      1.8×
 *   Sunday 23:00, 10th hr   weekend + night + overtime  2.1×
 */
export function classifyDay(
  punches: readonly ClassifierPunch[],
  rules: ClassifierRules,
): ClassifiedDay {
  const { intervals, unpairedIn, strayOut } = pairPunches(punches);

  const empty: ClassifiedDay = {
    workDateIso: punches.length > 0
      ? zonedParts(
          [...punches].sort((a, b) => a.occurredAt.getTime() - b.occurredAt.getTime())[0]!.occurredAt,
          rules.timeZone,
        ).isoDate
      : "",
    status: "OK",
    reviewReason: null,
    workedMinutes: 0,
    regularMinutes: 0,
    overtimeMinutes: 0,
    weekendMinutes: 0,
    holidayMinutes: 0,
    nightMinutes: 0,
    nightStackMinutes: 0,
    overtimeStackMinutes: 0,
    firstInAt: null,
    lastOutAt: null,
  };

  if (punches.length === 0) return empty;

  // An unresolved day contributes nothing until a human fixes it.
  if (unpairedIn || strayOut) {
    return {
      ...empty,
      status: "NEEDS_REVIEW",
      reviewReason: unpairedIn
        ? "Mungon dalja — orët nuk llogariten derisa të plotësohet."
        : "Skanime të papërputhura (hyrje/dalje) — orët nuk llogariten derisa të rregullohen.",
      firstInAt: intervals[0]?.start ?? punches[0]?.occurredAt ?? null,
      lastOutAt: null,
    };
  }

  if (intervals.length === 0) return empty;

  const workDateIso = zonedParts(intervals[0]!.start, rules.timeZone).isoDate;

  let workedMinutes = 0;
  let regularMinutes = 0;
  let overtimeMinutes = 0;
  let weekendMinutes = 0;
  let holidayMinutes = 0;
  let nightMinutes = 0;
  let nightStackMinutes = 0;
  let overtimeStackMinutes = 0;

  for (const interval of intervals) {
    const startMs = Math.floor(interval.start.getTime() / MINUTE_MS) * MINUTE_MS;
    const endMs = Math.floor(interval.end.getTime() / MINUTE_MS) * MINUTE_MS;

    let cursor = startMs;
    let facts = factsForMinute(new Date(cursor), rules);
    let offset = zoneOffsetMinutes(new Date(cursor), rules.timeZone);
    let factsHourMs = Math.floor((cursor + offset * MINUTE_MS) / 3_600_000);

    while (cursor < endMs) {
      // Facts only change on a local hour boundary (or a DST shift), so recompute
      // there rather than for all 1,440 minutes of a long shift.
      const localHourMs = Math.floor((cursor + offset * MINUTE_MS) / 3_600_000);
      if (localHourMs !== factsHourMs) {
        offset = zoneOffsetMinutes(new Date(cursor), rules.timeZone);
        facts = factsForMinute(new Date(cursor), rules);
        factsHourMs = Math.floor((cursor + offset * MINUTE_MS) / 3_600_000);
      }

      workedMinutes += 1;
      const isOvertime = workedMinutes > rules.dailyRegularMinutes;

      if (facts.isHoliday) {
        holidayMinutes += 1;
        if (isOvertime) overtimeStackMinutes += 1;
        if (facts.isNight) nightStackMinutes += 1;
      } else if (facts.isWeekend) {
        weekendMinutes += 1;
        if (isOvertime) overtimeStackMinutes += 1;
        if (facts.isNight) nightStackMinutes += 1;
      } else if (isOvertime) {
        overtimeMinutes += 1;
        if (facts.isNight) nightStackMinutes += 1;
      } else if (facts.isNight) {
        nightMinutes += 1;
      } else {
        regularMinutes += 1;
      }

      cursor += MINUTE_MS;
    }
  }

  return {
    workDateIso,
    status: "OK",
    reviewReason: null,
    workedMinutes,
    regularMinutes,
    overtimeMinutes,
    weekendMinutes,
    holidayMinutes,
    nightMinutes,
    nightStackMinutes,
    overtimeStackMinutes,
    firstInAt: intervals[0]!.start,
    lastOutAt: intervals[intervals.length - 1]!.end,
  };
}
