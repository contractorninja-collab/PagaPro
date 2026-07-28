/**
 * Inputs and outputs of the hour classifier. Everything here is plain data —
 * no Prisma, no Date arithmetic against "now" — so a day can be recomputed
 * identically at any later time from the same punches and rules.
 */

export type PunchDirection = "IN" | "OUT";

export interface ClassifierPunch {
  /** UTC instant of the punch. */
  occurredAt: Date;
  direction: PunchDirection;
}

export interface ClassifierRules {
  /**
   * Minutes of a normal day; anything beyond it is overtime.
   * Sourced from `PayrollSettings.hoursPerWorkingDay` × 60.
   */
  dailyRegularMinutes: number;
  /** Local hour the night window opens, inclusive (Neni 27.1 — 22:00). */
  nightStartHour: number;
  /** Local hour the night window closes, exclusive (Neni 27.1 — 06:00). */
  nightEndHour: number;
  /** `YYYY-MM-DD` dates treated as public holidays, from the company calendar. */
  holidayIsoDates: ReadonlySet<string>;
  /** IANA zone the local-day rules are evaluated in. */
  timeZone: string;
}

export type ClassifiedDayStatus = "OK" | "NEEDS_REVIEW";

export interface ClassifiedDay {
  /** `YYYY-MM-DD` the shift is attributed to — the day it started. */
  workDateIso: string;
  status: ClassifiedDayStatus;
  /** Albanian explanation when the day needs a human. */
  reviewReason: string | null;

  workedMinutes: number;
  /** Base-paying buckets. Each worked minute lands in exactly one of these. */
  regularMinutes: number;
  overtimeMinutes: number;
  weekendMinutes: number;
  holidayMinutes: number;
  /** Night minutes that are themselves the base bucket (a plain weekday night). */
  nightMinutes: number;
  /**
   * Minutes whose base pay sits in a higher bucket but which also qualify for this
   * premium — they earn the uplift (multiplier − 1) only, so a premium is never
   * paid twice over. A Sunday 23:00 hour is weekend base + a night uplift.
   */
  nightStackMinutes: number;
  overtimeStackMinutes: number;

  firstInAt: Date | null;
  lastOutAt: Date | null;
}

/** One resolved worked interval, half-open [start, end). */
export interface WorkedInterval {
  start: Date;
  end: Date;
}
