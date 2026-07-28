import { describe, expect, it } from "vitest";
import { classifyDay } from "./classify-day";
import type { ClassifierPunch, ClassifierRules } from "./types";

const TZ = "Europe/Belgrade";

function rules(overrides: Partial<ClassifierRules> = {}): ClassifierRules {
  return {
    dailyRegularMinutes: 8 * 60,
    nightStartHour: 22,
    nightEndHour: 6,
    holidayIsoDates: new Set<string>(),
    timeZone: TZ,
    ...overrides,
  };
}

/** Local wall-clock helper — Kosovo is UTC+2 in summer, UTC+1 in winter. */
function local(iso: string, offsetHours: number): Date {
  return new Date(`${iso}:00.000${offsetHours >= 0 ? "+" : "-"}${String(Math.abs(offsetHours)).padStart(2, "0")}:00`);
}

function shift(inAt: Date, outAt: Date): ClassifierPunch[] {
  return [
    { occurredAt: inAt, direction: "IN" },
    { occurredAt: outAt, direction: "OUT" },
  ];
}

describe("classifyDay", () => {
  it("counts a plain weekday shift as regular hours", () => {
    // Wednesday 8 July 2026, 09:00–17:00 local (summer, UTC+2).
    const day = classifyDay(
      shift(local("2026-07-08T09:00", 2), local("2026-07-08T17:00", 2)),
      rules(),
    );

    expect(day.status).toBe("OK");
    expect(day.workDateIso).toBe("2026-07-08");
    expect(day.workedMinutes).toBe(480);
    expect(day.regularMinutes).toBe(480);
    expect(day.overtimeMinutes).toBe(0);
    expect(day.nightMinutes).toBe(0);
    expect(day.weekendMinutes).toBe(0);
  });

  it("treats time past the daily threshold as overtime", () => {
    // 10-hour Wednesday: 8 regular + 2 overtime.
    const day = classifyDay(
      shift(local("2026-07-08T08:00", 2), local("2026-07-08T18:00", 2)),
      rules(),
    );

    expect(day.workedMinutes).toBe(600);
    expect(day.regularMinutes).toBe(480);
    expect(day.overtimeMinutes).toBe(120);
  });

  it("splits an overnight shift and attributes it to the day it started", () => {
    // Wednesday 21:00 → Thursday 05:00. Night window is 22:00–06:00, so one hour
    // is ordinary evening and seven are night; the whole shift belongs to the 8th.
    const day = classifyDay(
      shift(local("2026-07-08T21:00", 2), local("2026-07-09T05:00", 2)),
      rules(),
    );

    expect(day.workDateIso).toBe("2026-07-08");
    expect(day.workedMinutes).toBe(480);
    expect(day.regularMinutes).toBe(60);
    expect(day.nightMinutes).toBe(420);
    expect(day.overtimeMinutes).toBe(0);
  });

  it("pays a Sunday night hour as weekend base plus a night uplift, never twice", () => {
    // Sunday 12 July 2026, 23:00 → 00:00.
    const day = classifyDay(
      shift(local("2026-07-12T23:00", 2), local("2026-07-13T00:00", 2)),
      rules(),
    );

    expect(day.workedMinutes).toBe(60);
    // Base sits in weekend at the full 1.5×…
    expect(day.weekendMinutes).toBe(60);
    // …and night rides along as an uplift only.
    expect(day.nightStackMinutes).toBe(60);
    expect(day.nightMinutes).toBe(0);
  });

  it("stacks overtime onto a weekend day without double-paying the base", () => {
    // Saturday 10 hours: all weekend base, the last two also overtime.
    const day = classifyDay(
      shift(local("2026-07-11T08:00", 2), local("2026-07-11T18:00", 2)),
      rules(),
    );

    expect(day.weekendMinutes).toBe(600);
    expect(day.overtimeMinutes).toBe(0);
    expect(day.overtimeStackMinutes).toBe(120);
  });

  it("puts a public holiday above a weekday and stacks night on top", () => {
    // 17 February 2026 (Independence Day) is a Tuesday; winter, so UTC+1.
    const day = classifyDay(
      shift(local("2026-02-17T20:00", 1), local("2026-02-18T00:00", 1)),
      rules({ holidayIsoDates: new Set(["2026-02-17"]) }),
    );

    expect(day.workedMinutes).toBe(240);
    expect(day.holidayMinutes).toBe(240);
    expect(day.nightStackMinutes).toBe(120); // 22:00–00:00
    expect(day.regularMinutes).toBe(0);
  });

  it("flags a missing clock-out and pays nothing for that day", () => {
    const day = classifyDay(
      [{ occurredAt: local("2026-07-08T09:00", 2), direction: "IN" }],
      rules(),
    );

    expect(day.status).toBe("NEEDS_REVIEW");
    expect(day.reviewReason).toContain("Mungon dalja");
    expect(day.workedMinutes).toBe(0);
    expect(day.regularMinutes).toBe(0);
  });

  it("flags mismatched scans rather than guessing a pairing", () => {
    const day = classifyDay(
      [
        { occurredAt: local("2026-07-08T09:00", 2), direction: "OUT" },
        { occurredAt: local("2026-07-08T17:00", 2), direction: "IN" },
      ],
      rules(),
    );

    expect(day.status).toBe("NEEDS_REVIEW");
    expect(day.workedMinutes).toBe(0);
  });

  it("adds up split shifts across a lunch break", () => {
    const day = classifyDay(
      [
        { occurredAt: local("2026-07-08T09:00", 2), direction: "IN" },
        { occurredAt: local("2026-07-08T13:00", 2), direction: "OUT" },
        { occurredAt: local("2026-07-08T14:00", 2), direction: "IN" },
        { occurredAt: local("2026-07-08T18:00", 2), direction: "OUT" },
      ],
      rules(),
    );

    // The unpaid hour between is simply not worked time.
    expect(day.workedMinutes).toBe(480);
    expect(day.regularMinutes).toBe(480);
    expect(day.overtimeMinutes).toBe(0);
    expect(day.firstInAt).toEqual(local("2026-07-08T09:00", 2));
    expect(day.lastOutAt).toEqual(local("2026-07-08T18:00", 2));
  });

  it("returns an empty day when there are no punches", () => {
    const day = classifyDay([], rules());
    expect(day.workedMinutes).toBe(0);
    expect(day.status).toBe("OK");
  });
});
