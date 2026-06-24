import { describe, expect, it } from "vitest";
import { kosovo2026AtkDefaults } from "../legislation/defaults";
import {
  computePayrollSpreadsheetLine,
  type PayrollMonthCalendarSnapshot,
} from "../payroll-spreadsheet-line";

const snapshot = kosovo2026AtkDefaults();

const calendarBase: PayrollMonthCalendarSnapshot = {
  expectedWorkingDays: 22,
  expectedRegularHours: "176",
  hoursPerWorkingDay: "8",
  weekdayPublicHolidayDates: [],
  overtimeWeeklyThresholdHours: "40",
  overtimeWarningWeeklyHours: "48",
  standardWeeklyHours: "40",
  nightWorkPeriodDescription: "22:00–06:00",
};

function lineInput(overrides: Partial<{ expectedRegularHours: string; actualRegularHours: string }> = {}) {
  return {
    expectedWorkingDays: 22,
    expectedRegularHours: overrides.expectedRegularHours ?? "176",
    actualRegularHours: overrides.actualRegularHours ?? "176",
    paidLeaveHours: "0",
    sickLeaveHours: "0",
    unpaidLeaveHours: "0",
    overtimeHours: "0",
    weekendHours: "0",
    holidayHours: "0",
    nightHours: "0",
    bonuses: "0",
    otherDeductions: "0",
    salaryAdvanceDeduction: "0",
  };
}

const employeeGross1000 = {
  employmentType: "EMPLOYEE" as const,
  employerPrimacy: "PRIMARY" as const,
  baseSalaryMonthly: "1000",
  compensationBasis: "GROSS_MONTHLY" as const,
  targetNetMonthly: null,
  exemptFromMinimumSalary: false,
};

describe("computePayrollSpreadsheetLine — hourly × hours (full-precision rate)", () => {
  it("preserves contractual monthly gross when actual regular hours equal expected (1000 ÷ 176 × 176)", () => {
    const r = computePayrollSpreadsheetLine(
      employeeGross1000,
      lineInput(),
      snapshot,
      "1",
      calendarBase,
    );

    expect(r.ok).toBe(true);
    if (!r.ok) return;

    expect(r.value.regularPay).toBe("1000.00");
    expect(r.value.grossSalary).toBe("1000.00");
    expect(r.value.hourlyRate).toMatch(/^5\.681818/);
  });

  it("matches monthly gross for standardMonthlyHours-style denominator (173.33)", () => {
    const denom = "173.33";
    const r = computePayrollSpreadsheetLine(
      employeeGross1000,
      lineInput({ expectedRegularHours: denom, actualRegularHours: denom }),
      snapshot,
      "1",
      { ...calendarBase, expectedRegularHours: denom },
    );

    expect(r.ok).toBe(true);
    if (!r.ok) return;

    expect(r.value.regularPay).toBe("1000.00");
    expect(r.value.grossSalary).toBe("1000.00");
  });
});
