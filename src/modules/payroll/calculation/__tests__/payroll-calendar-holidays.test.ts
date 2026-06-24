import { describe, expect, it } from "vitest";
import { splitPayrollMonthWorkingDays } from "../../services/payroll-calendar-service";

describe("splitPayrollMonthWorkingDays — weekday holidays from merged calendar", () => {
  it("February 2026 excludes a configured weekday holiday (Independence Day)", () => {
    const r = splitPayrollMonthWorkingDays(2026, 2, ["2026-02-17"]);
    expect(r.weekdayPublicHolidayDates).toContain("2026-02-17");
    const naiveFeb2026Weekdays = 20;
    expect(r.workingDaysMondayFridayExcludingHolidays).toBe(naiveFeb2026Weekdays - 1);
  });

  it("adds an extra weekday holiday on top of the Kosovo May baseline", () => {
    const kosovoMay2026Weekday = ["2026-05-01"]; // Labour Day — Friday in 2026
    const baseline = splitPayrollMonthWorkingDays(2026, 5, kosovoMay2026Weekday);
    const withExtra = splitPayrollMonthWorkingDays(2026, 5, [...kosovoMay2026Weekday, "2026-05-04"]);
    expect(withExtra.weekdayPublicHolidayDates).toContain("2026-05-04");
    expect(withExtra.workingDaysMondayFridayExcludingHolidays).toBe(
      baseline.workingDaysMondayFridayExcludingHolidays - 1,
    );
  });

  it("omitting a date from the configured list restores it as a working weekday", () => {
    const withHoliday = splitPayrollMonthWorkingDays(2026, 2, ["2026-02-17"]);
    const without = splitPayrollMonthWorkingDays(2026, 2, []);
    expect(without.workingDaysMondayFridayExcludingHolidays).toBe(
      withHoliday.workingDaysMondayFridayExcludingHolidays + 1,
    );
  });
});
