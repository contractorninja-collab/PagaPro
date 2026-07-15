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

function lineInput(
  overrides: Partial<{
    expectedRegularHours: string;
    actualRegularHours: string;
    paidLeaveHours: string;
    weekendHours: string;
    holidayHours: string;
  }> = {},
) {
  return {
    expectedWorkingDays: 22,
    expectedRegularHours: overrides.expectedRegularHours ?? "176",
    actualRegularHours: overrides.actualRegularHours ?? "176",
    paidLeaveHours: overrides.paidLeaveHours ?? "0",
    sickLeaveHours: "0",
    unpaidLeaveHours: "0",
    overtimeHours: "0",
    weekendHours: overrides.weekendHours ?? "0",
    holidayHours: overrides.holidayHours ?? "0",
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
  applyTrust: true,
  applyTax: true,
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

  it("reduces gross when actual regular hours are below expected (1000 ÷ 168 × 160)", () => {
    const r = computePayrollSpreadsheetLine(
      employeeGross1000,
      lineInput({ expectedRegularHours: "168", actualRegularHours: "160" }),
      snapshot,
      "1",
      { ...calendarBase, expectedRegularHours: "168" },
    );

    expect(r.ok).toBe(true);
    if (!r.ok) return;

    // 1000 ÷ 168 × 160 ≈ 952.38 — 8 missing hours unpaid
    expect(r.value.hourlyRate).toMatch(/^5\.95238/);
    expect(r.value.regularPay).toBe("952.38");
    expect(r.value.grossSalary).toBe("952.38");
  });

  it("zeroes the line when regular hours are 0 (full unpaid-leave month) without erroring", () => {
    const r = computePayrollSpreadsheetLine(
      employeeGross1000,
      lineInput({ expectedRegularHours: "176", actualRegularHours: "0" }),
      snapshot,
      "1",
      calendarBase,
    );

    expect(r.ok).toBe(true);
    if (!r.ok) return;

    expect(r.value.regularPay).toBe("0.00");
    expect(r.value.grossSalary).toBe("0.00");
    expect(r.value.netPay).toBe("0.00");
    expect(r.value.pensionEmployee).toBe("0.00");
    expect(r.value.pensionEmployer).toBe("0.00");
    expect(r.value.pitWithheld).toBe("0.00");
  });

  it("does not overpay when paid leave is present: rate stays calendar-based (gross = 1000, not 1100)", () => {
    // 16h paid leave, 160h worked. Rate must remain 1000 ÷ 176 so regular + paid leave = full salary.
    const r = computePayrollSpreadsheetLine(
      employeeGross1000,
      lineInput({ expectedRegularHours: "176", actualRegularHours: "160", paidLeaveHours: "16" }),
      snapshot,
      "1",
      calendarBase,
    );

    expect(r.ok).toBe(true);
    if (!r.ok) return;

    expect(r.value.hourlyRate).toMatch(/^5\.681818/);
    expect(r.value.grossSalary).toBe("1000.00");
  });

  it("prorates a partial month (termination): rate uses the FULL calendar month, not the partial line hours", () => {
    // Largim mes muajit: rreshti pret 88h (11 nga 22 ditë), kalendari i muajit të plotë 176h.
    // Norma duhet 1000 ÷ 176 → bruto = 88 × normë = 500.00 (jo paga e plotë mujore).
    const r = computePayrollSpreadsheetLine(
      employeeGross1000,
      { ...lineInput({ expectedRegularHours: "88", actualRegularHours: "88" }), expectedWorkingDays: 11 },
      snapshot,
      "1",
      calendarBase,
    );

    expect(r.ok).toBe(true);
    if (!r.ok) return;

    expect(r.value.hourlyRate).toMatch(/^5\.681818/);
    expect(r.value.regularPay).toBe("500.00");
    expect(r.value.grossSalary).toBe("500.00");
  });

  it("deducts unpaid leave exactly once: unpaid hours stay inside regular hours and only the deduction removes them", () => {
    // Modeli i motorit: actualReg PËRFSHIN orët pa pagesë; zbritja i heq një herë.
    // 176h reg (16 prej tyre pa pagesë) → bruto = 1000 − 16 × normë = 909.09.
    const r = computePayrollSpreadsheetLine(
      employeeGross1000,
      { ...lineInput(), unpaidLeaveHours: "16" },
      snapshot,
      "1",
      calendarBase,
    );

    expect(r.ok).toBe(true);
    if (!r.ok) return;

    expect(r.value.regularPay).toBe("1000.00");
    expect(r.value.unpaidLeaveDeduction).toBe("90.91");
    expect(r.value.grossSalary).toBe("909.09");
  });

  describe("part-time (20h/javë → 88h muaj, kalendar i shkallëzuar për punonjësin)", () => {
    const partTimeCalendar: PayrollMonthCalendarSnapshot = {
      ...calendarBase,
      expectedRegularHours: "88",
      hoursPerWorkingDay: "4",
    };
    const employeeGross500 = { ...employeeGross1000, baseSalaryMonthly: "500", exemptFromMinimumSalary: true };

    it("preserves contractual gross for a full part-time month (500 ÷ 88 × 88)", () => {
      const r = computePayrollSpreadsheetLine(
        employeeGross500,
        lineInput({ expectedRegularHours: "88", actualRegularHours: "88" }),
        snapshot,
        "1",
        partTimeCalendar,
      );

      expect(r.ok).toBe(true);
      if (!r.ok) return;

      expect(r.value.hourlyRate).toMatch(/^5\.681818/);
      expect(r.value.grossSalary).toBe("500.00");
    });

    it("sick week at 70%: reduction scales to the employee's month (gross 465.91, not 482.95)", () => {
      // 5 ditë × 4h = 20h mjekësore me 70%: 500×68/88 + 500×14/88 = 386.36 + 79.55.
      // SHËNIM: 70% këtu teston vetëm mekanikën e shkallëzimit të motorit — në prodhim
      // statutorySickLeavePayPercent() (Neni 60) e ngre çdo vlerë nën 100% në 100%.
      const r = computePayrollSpreadsheetLine(
        employeeGross500,
        { ...lineInput({ expectedRegularHours: "88", actualRegularHours: "68" }), sickLeaveHours: "20" },
        snapshot,
        "0.7",
        partTimeCalendar,
      );

      expect(r.ok).toBe(true);
      if (!r.ok) return;

      expect(r.value.regularPay).toBe("386.36");
      expect(r.value.sickLeavePay).toBe("79.55");
      expect(r.value.grossSalary).toBe("465.91");
    });

    it("unpaid week: deduction scales to the employee's month (gross 386.36, not 443.18)", () => {
      // 20h pa pagesë brenda 88h → zbritja 500×20/88 = 113.64.
      const r = computePayrollSpreadsheetLine(
        employeeGross500,
        { ...lineInput({ expectedRegularHours: "88", actualRegularHours: "88" }), unpaidLeaveHours: "20" },
        snapshot,
        "1",
        partTimeCalendar,
      );

      expect(r.ok).toBe(true);
      if (!r.ok) return;

      expect(r.value.regularPay).toBe("500.00");
      expect(r.value.unpaidLeaveDeduction).toBe("113.64");
      expect(r.value.grossSalary).toBe("386.36");
    });
  });

  it("pays holiday (Festë) hours at the same +50% premium as weekend hours when multipliers are 1.5", () => {
    const snap = kosovo2026AtkDefaults({
      premiumRules: {
        weekendHourMultiplier: "1.5",
        holidayHourMultiplier: "1.5",
      },
    });

    const r = computePayrollSpreadsheetLine(
      employeeGross1000,
      lineInput({ weekendHours: "8", holidayHours: "8" }),
      snap,
      "1",
      calendarBase,
    );

    expect(r.ok).toBe(true);
    if (!r.ok) return;

    // hourly ≈ 5.681818; 8h × 1.5 × rate ≈ 68.18 each
    expect(r.value.weekendAmount).toBe("68.18");
    expect(r.value.holidayAmount).toBe(r.value.weekendAmount);
    expect(r.value.grossSalary).toBe("1136.36");
  });
});
