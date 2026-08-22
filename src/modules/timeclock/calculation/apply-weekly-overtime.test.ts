import { describe, expect, it } from "vitest";
import { applyWeeklyOvertime, isoWeekKey } from "./apply-weekly-overtime";
import type { ClassifiedDay } from "./types";

const WEEK_MINUTES = 40 * 60;

function day(workDateIso: string, over: Partial<ClassifiedDay> = {}): ClassifiedDay {
  const worked = over.workedMinutes ?? 0;
  return {
    workDateIso,
    status: "OK",
    reviewReason: null,
    workedMinutes: worked,
    regularMinutes: over.regularMinutes ?? worked,
    overtimeMinutes: 0,
    weekendMinutes: 0,
    holidayMinutes: 0,
    nightMinutes: 0,
    nightStackMinutes: 0,
    overtimeStackMinutes: 0,
    firstInAt: null,
    lastOutAt: null,
    ...over,
  };
}

describe("isoWeekKey", () => {
  it("anchors every day of a week to its Monday", () => {
    // 2026-08-17 is a Monday.
    expect(isoWeekKey("2026-08-17")).toBe("2026-08-17");
    expect(isoWeekKey("2026-08-22")).toBe("2026-08-17"); // Saturday
    expect(isoWeekKey("2026-08-23")).toBe("2026-08-17"); // Sunday
    expect(isoWeekKey("2026-08-24")).toBe("2026-08-24"); // next Monday
  });
});

describe("applyWeeklyOvertime", () => {
  it("promotes nothing in a plain 40-hour week", () => {
    const days = ["17", "18", "19", "20", "21"].map((d) =>
      day(`2026-08-${d}`, { workedMinutes: 480 }),
    );
    const out = applyWeeklyOvertime(days, WEEK_MINUTES);
    expect(out.every((d) => d.overtimeMinutes === 0)).toBe(true);
  });

  it("finds the overtime the daily rule cannot see: six 7-hour days", () => {
    // 6 × 7h = 42h. No day exceeds 8h, so the per-day classifier said zero
    // overtime — but the week crossed 40h on Saturday.
    const days = ["17", "18", "19", "20", "21", "22"].map((d) =>
      day(`2026-08-${d}`, { workedMinutes: 420 }),
    );
    const out = applyWeeklyOvertime(days, WEEK_MINUTES);

    expect(out.slice(0, 5).every((d) => d.overtimeMinutes === 0)).toBe(true);
    const saturday = out[5]!;
    expect(saturday.overtimeMinutes).toBe(120); // the 2h beyond 40
    expect(saturday.regularMinutes).toBe(300);
    expect(saturday.workedMinutes).toBe(420); // total untouched
  });

  it("attributes the overflow to the day the norm was crossed, split correctly", () => {
    // 4 × 9h (daily rule already made 1h/day OT) + Friday 8h = 44h.
    // Weekly overflow is 4h; daily OT already claimed 4h of it. The pass only
    // counts against the weekly norm — Friday crosses it at the 36h+4h mark.
    const days = [
      day("2026-08-17", { workedMinutes: 540, regularMinutes: 480, overtimeMinutes: 60 }),
      day("2026-08-18", { workedMinutes: 540, regularMinutes: 480, overtimeMinutes: 60 }),
      day("2026-08-19", { workedMinutes: 540, regularMinutes: 480, overtimeMinutes: 60 }),
      day("2026-08-20", { workedMinutes: 540, regularMinutes: 480, overtimeMinutes: 60 }),
      day("2026-08-21", { workedMinutes: 480 }),
    ];
    const out = applyWeeklyOvertime(days, WEEK_MINUTES);

    // Week total 44h → 4h beyond norm, all landing inside Friday's minutes
    // (cumulative before Friday = 36h, after = 44h → overflow-in-day = 4h).
    const friday = out[4]!;
    expect(friday.overtimeMinutes).toBe(240);
    expect(friday.regularMinutes).toBe(240);
  });

  it("never promotes premium minutes, only plain regular ones", () => {
    // Saturday is all weekend minutes; they count toward the norm but keep
    // their weekend base.
    const days = [
      ...["17", "18", "19", "20", "21"].map((d) => day(`2026-08-${d}`, { workedMinutes: 480 })),
      day("2026-08-22", { workedMinutes: 240, regularMinutes: 0, weekendMinutes: 240 }),
    ];
    const out = applyWeeklyOvertime(days, WEEK_MINUTES);
    const saturday = out[5]!;

    expect(saturday.weekendMinutes).toBe(240);
    expect(saturday.overtimeMinutes).toBe(0);
  });

  it("resets at the week boundary", () => {
    const days = [
      day("2026-08-22", { workedMinutes: 480 }), // Saturday, week 1
      day("2026-08-24", { workedMinutes: 480 }), // Monday, week 2
    ];
    const out = applyWeeklyOvertime(days, WEEK_MINUTES);
    expect(out.every((d) => d.overtimeMinutes === 0)).toBe(true);
  });

  it("skips review days without advancing the weekly counter", () => {
    const days = [
      ...["17", "18", "19", "20", "21"].map((d) => day(`2026-08-${d}`, { workedMinutes: 480 })),
      day("2026-08-22", { status: "NEEDS_REVIEW", workedMinutes: 0, regularMinutes: 0 }),
    ];
    const out = applyWeeklyOvertime(days, WEEK_MINUTES);
    expect(out.every((d) => d.overtimeMinutes === 0)).toBe(true);
  });

  it("handles unsorted input", () => {
    const days = [
      day("2026-08-22", { workedMinutes: 420 }),
      ...["17", "18", "19", "20", "21"].map((d) => day(`2026-08-${d}`, { workedMinutes: 420 })),
    ];
    const out = applyWeeklyOvertime(days, WEEK_MINUTES);
    const saturday = out.find((d) => d.workDateIso === "2026-08-22")!;
    expect(saturday.overtimeMinutes).toBe(120);
  });

  it("is a no-op when the threshold is unset", () => {
    const days = [day("2026-08-17", { workedMinutes: 3000 })];
    expect(applyWeeklyOvertime(days, 0)[0]!.overtimeMinutes).toBe(0);
  });
});
