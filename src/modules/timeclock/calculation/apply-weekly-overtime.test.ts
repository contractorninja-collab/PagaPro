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

  it("never double-counts hours the daily rule already made overtime", () => {
    // Five 9-hour days: 45h. The daily rule already classified 1h/day = 5h of
    // overtime, and the weekly requirement is max(0, 45h − 40h) = the SAME 5h.
    // A naive weekly pass would add another 5h and pay a 45-hour week as if
    // it carried 10h of overtime.
    const days = ["17", "18", "19", "20", "21"].map((d) =>
      day(`2026-08-${d}`, { workedMinutes: 540, regularMinutes: 480, overtimeMinutes: 60 }),
    );
    const out = applyWeeklyOvertime(days, WEEK_MINUTES);

    const totalOt = out.reduce((s, d) => s + d.overtimeMinutes, 0);
    expect(totalOt).toBe(300); // exactly 5h — unchanged
    expect(out.every((d) => d.regularMinutes === 480)).toBe(true);
  });

  it("tops up only the deficit when daily overtime covers part of the week's overflow", () => {
    // Mon 10h (2h daily OT) + Tue–Fri 8h = 42h. Weekly requirement 2h, already
    // fully supplied by Monday's daily OT → nothing more is promoted.
    const days = [
      day("2026-08-17", { workedMinutes: 600, regularMinutes: 480, overtimeMinutes: 120 }),
      ...["18", "19", "20", "21"].map((d) => day(`2026-08-${d}`, { workedMinutes: 480 })),
    ];
    const out = applyWeeklyOvertime(days, WEEK_MINUTES);
    expect(out.reduce((s, d) => s + d.overtimeMinutes, 0)).toBe(120);

    // But Mon 9h (1h OT) + Tue–Sat 7h = 44h: requirement 4h, daily supplied 1h,
    // so exactly 3h more is promoted where the norm was crossed.
    const days2 = [
      day("2026-08-17", { workedMinutes: 540, regularMinutes: 480, overtimeMinutes: 60 }),
      ...["18", "19", "20", "21", "22"].map((d) => day(`2026-08-${d}`, { workedMinutes: 420 })),
    ];
    const out2 = applyWeeklyOvertime(days2, WEEK_MINUTES);
    expect(out2.reduce((s, d) => s + d.overtimeMinutes, 0)).toBe(240); // 4h total
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
