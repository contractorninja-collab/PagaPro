import { describe, expect, it } from "vitest";
import {
  countWorkingDaysInWindow,
  resolveEmploymentWindow,
} from "@/modules/payroll/calculation/employment-window";

/** April 2026: starts Wednesday, 22 Mon–Fri days, Apr 9 (Thu) is Dita e Kushtetutës. */
const APRIL_START = new Date(Date.UTC(2026, 3, 1));
const APRIL_END = new Date(Date.UTC(2026, 3, 30));
const NO_HOLIDAYS = new Set<string>();
const APRIL_HOLIDAYS = new Set(["2026-04-09"]);

function april(day: number): Date {
  return new Date(Date.UTC(2026, 3, day));
}

describe("resolveEmploymentWindow — no period rows (employees created before the table)", () => {
  it("treats an ordinary active employee as employed all month", () => {
    const w = resolveEmploymentWindow({
      periods: [],
      hireDate: new Date(Date.UTC(2020, 0, 1)),
      terminationDate: null,
      monthStart: APRIL_START,
      monthEnd: APRIL_END,
    });
    expect(w.employed).toBe(true);
    expect(w.partial).toBe(false);
    expect(countWorkingDaysInWindow(w, NO_HOLIDAYS)).toBe(22);
  });

  it("pro-rates a mid-month joiner instead of paying a whole month", () => {
    const w = resolveEmploymentWindow({
      periods: [],
      hireDate: april(20),
      terminationDate: null,
      monthStart: APRIL_START,
      monthEnd: APRIL_END,
    });
    expect(w.partial).toBe(true);
    // Apr 20–24 and Apr 27–30.
    expect(countWorkingDaysInWindow(w, NO_HOLIDAYS)).toBe(9);
  });

  it("pro-rates a leaver at the termination date", () => {
    const w = resolveEmploymentWindow({
      periods: [],
      hireDate: new Date(Date.UTC(2020, 0, 1)),
      terminationDate: april(10),
      monthStart: APRIL_START,
      monthEnd: APRIL_END,
    });
    expect(countWorkingDaysInWindow(w, NO_HOLIDAYS)).toBe(8);
  });

  it("excludes a weekday public holiday, exactly as the full-month figure does", () => {
    const w = resolveEmploymentWindow({
      periods: [],
      hireDate: new Date(Date.UTC(2020, 0, 1)),
      terminationDate: april(10),
      monthStart: APRIL_START,
      monthEnd: APRIL_END,
    });
    // Apr 9 falls inside Apr 1–10 and must not be paid.
    expect(countWorkingDaysInWindow(w, APRIL_HOLIDAYS)).toBe(7);
  });

  it("says not employed when the person left before the month began", () => {
    const w = resolveEmploymentWindow({
      periods: [],
      hireDate: new Date(Date.UTC(2020, 0, 1)),
      terminationDate: new Date(Date.UTC(2026, 2, 15)),
      monthStart: APRIL_START,
      monthEnd: APRIL_END,
    });
    expect(w.employed).toBe(false);
    expect(countWorkingDaysInWindow(w, NO_HOLIDAYS)).toBe(0);
  });
});

describe("resolveEmploymentWindow — the rehire gap", () => {
  // Hired 2020, left 2026-03-15, came back 2026-06-01. rehireEmployee clears
  // terminationDate and leaves hireDate at 2020, so the columns alone say
  // "employed since 2020, never left".
  const REHIRED = {
    periods: [
      { startedAt: new Date(Date.UTC(2020, 0, 1)), endedAt: new Date(Date.UTC(2026, 2, 15)) },
      { startedAt: new Date(Date.UTC(2026, 5, 1)), endedAt: null },
    ],
    hireDate: new Date(Date.UTC(2020, 0, 1)),
    terminationDate: null,
  };

  it("pays nothing for a gap month", () => {
    const w = resolveEmploymentWindow({ ...REHIRED, monthStart: APRIL_START, monthEnd: APRIL_END });
    expect(w.employed).toBe(false);
    expect(countWorkingDaysInWindow(w, NO_HOLIDAYS)).toBe(0);
  });

  it("still pays the month they actually left in, up to the last day", () => {
    const w = resolveEmploymentWindow({
      ...REHIRED,
      monthStart: new Date(Date.UTC(2026, 2, 1)),
      monthEnd: new Date(Date.UTC(2026, 2, 31)),
    });
    expect(w.employed).toBe(true);
    // 2026-03-02..13 is 10 weekdays, plus Mon 16th is past the 15th — so Mar 2–13
    // plus nothing else; the 15th is a Sunday.
    expect(countWorkingDaysInWindow(w, NO_HOLIDAYS)).toBe(10);
  });

  it("pays the full month they returned in when they returned on the 1st", () => {
    const w = resolveEmploymentWindow({
      ...REHIRED,
      monthStart: new Date(Date.UTC(2026, 5, 1)),
      monthEnd: new Date(Date.UTC(2026, 5, 30)),
    });
    expect(w.employed).toBe(true);
    expect(w.partial).toBe(false);
  });

  it("pro-rates a mid-month return", () => {
    const w = resolveEmploymentWindow({
      periods: [
        { startedAt: new Date(Date.UTC(2020, 0, 1)), endedAt: new Date(Date.UTC(2026, 2, 15)) },
        { startedAt: april(20), endedAt: null },
      ],
      hireDate: new Date(Date.UTC(2020, 0, 1)),
      terminationDate: null,
      monthStart: APRIL_START,
      monthEnd: APRIL_END,
    });
    expect(countWorkingDaysInWindow(w, NO_HOLIDAYS)).toBe(9);
  });

  it("adds up both stretches when someone leaves and returns inside one month", () => {
    const w = resolveEmploymentWindow({
      periods: [
        { startedAt: new Date(Date.UTC(2020, 0, 1)), endedAt: april(3) },
        { startedAt: april(27), endedAt: null },
      ],
      hireDate: new Date(Date.UTC(2020, 0, 1)),
      terminationDate: null,
      monthStart: APRIL_START,
      monthEnd: APRIL_END,
    });
    expect(w.segments).toHaveLength(2);
    // Apr 1–3 is 3 weekdays; Apr 27–30 is 4.
    expect(countWorkingDaysInWindow(w, NO_HOLIDAYS)).toBe(7);
  });
});

describe("resolveEmploymentWindow — the recorded dates stay a ceiling", () => {
  it("does not pay past a recorded termination when a period was left open", () => {
    // A path that forgot to close the period must not resurrect a leaver.
    const w = resolveEmploymentWindow({
      periods: [{ startedAt: new Date(Date.UTC(2020, 0, 1)), endedAt: null }],
      hireDate: new Date(Date.UTC(2020, 0, 1)),
      terminationDate: april(10),
      monthStart: APRIL_START,
      monthEnd: APRIL_END,
    });
    expect(countWorkingDaysInWindow(w, NO_HOLIDAYS)).toBe(8);
  });

  it("does not pay before the hire date even if a period claims otherwise", () => {
    const w = resolveEmploymentWindow({
      periods: [{ startedAt: new Date(Date.UTC(2019, 0, 1)), endedAt: null }],
      hireDate: april(20),
      terminationDate: null,
      monthStart: APRIL_START,
      monthEnd: APRIL_END,
    });
    expect(countWorkingDaysInWindow(w, NO_HOLIDAYS)).toBe(9);
  });

  it("merges a same-day return so the boundary day is not paid twice", () => {
    const w = resolveEmploymentWindow({
      periods: [
        { startedAt: april(1), endedAt: april(15) },
        { startedAt: april(15), endedAt: null },
      ],
      hireDate: april(1),
      terminationDate: null,
      monthStart: APRIL_START,
      monthEnd: APRIL_END,
    });
    expect(w.segments).toHaveLength(1);
    expect(countWorkingDaysInWindow(w, NO_HOLIDAYS)).toBe(22);
  });
});
