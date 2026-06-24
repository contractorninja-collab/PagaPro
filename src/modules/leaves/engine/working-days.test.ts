import { describe, expect, it } from "vitest";
import { computeWorkingDaysInRange, countCalendarDaysInclusiveUtc } from "@/modules/leaves/engine/working-days";

describe("working-days engine", () => {
  it("excludes weekends", () => {
    const start = new Date(Date.UTC(2025, 0, 6, 12, 0, 0, 0)); // Mon
    const end = new Date(Date.UTC(2025, 0, 12, 12, 0, 0, 0)); // Sun
    const r = computeWorkingDaysInRange(start, end, new Set(), 8);
    expect(r.workingDays).toBe(5);
    expect(r.totalHours).toBe("40.00");
  });

  it("excludes Mon–Fri dates present in holiday ISO set", () => {
    const start = new Date(Date.UTC(2025, 0, 6, 12, 0, 0, 0));
    const end = new Date(Date.UTC(2025, 0, 10, 12, 0, 0, 0));
    const set = new Set<string>(["2025-01-08"]);
    const r = computeWorkingDaysInRange(start, end, set, 8);
    expect(r.workingDays).toBe(4);
    expect(r.weekdayHolidayDatesInRange).toContain("2025-01-08");
  });

  it("counts inclusive calendar days", () => {
    const s = new Date(Date.UTC(2025, 3, 1, 0, 0, 0, 0));
    const e = new Date(Date.UTC(2025, 3, 3, 0, 0, 0, 0));
    expect(countCalendarDaysInclusiveUtc(s, e)).toBe(3);
  });
});
