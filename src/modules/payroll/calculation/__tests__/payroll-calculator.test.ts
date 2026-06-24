import { describe, expect, it } from "vitest";
import { kosovo2026AtkDefaults } from "../legislation/defaults";
import {
  calculateContractorLineSafe,
  calculateEmployeeLine,
} from "../payroll-calculator";
import { calculateContractorLine } from "../contractor/contractor-line";

/** Snapshot with derived hourly minimum enforcement (450 € / 173.33 h). */
const snapshotWithStandardHours = kosovo2026AtkDefaults({
  standardMonthlyHours: "173.33",
});

/** Snapshot without derived hourly rules — useful for gross override scenarios. */
const snapshotPlain = kosovo2026AtkDefaults();

describe("calculateEmployeeLine — Kosovo 2026 defaults", () => {
  it("applies progressive ATK for PRIMARY employer primacy", () => {
    const result = calculateEmployeeLine(
      {
        employmentType: "EMPLOYEE",
        employerPrimacy: "PRIMARY",
        hours: { regularHours: "40" },
        rates: { hourlyRate: "15" },
      },
      snapshotWithStandardHours,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.grossSalary).toBe("600.00");
    expect(result.value.pensionEmployee).toBe("30.00");
    expect(result.value.taxableIncome).toBe("570.00");
    expect(result.value.pitWithheld).toBe("28.00");
    expect(result.value.netPay).toBe("542.00");
    expect(result.value.breakdown.atkRegime).toBe("PRIMARY_PROGRESSIVE");
  });

  it("PRIMARY progressive differs materially from SECONDARY flat on identical gross", () => {
    const progressive = calculateEmployeeLine(
      {
        employmentType: "EMPLOYEE",
        employerPrimacy: "PRIMARY",
        grossSalaryOverride: "500.00",
        hours: { regularHours: "0" },
        rates: { hourlyRate: "10" },
        enforceMinimumGross: false,
      },
      snapshotPlain,
    );

    const secondary = calculateEmployeeLine(
      {
        employmentType: "EMPLOYEE",
        employerPrimacy: "SECONDARY",
        grossSalaryOverride: "500.00",
        hours: { regularHours: "0" },
        rates: { hourlyRate: "10" },
        enforceMinimumGross: false,
      },
      snapshotPlain,
    );

    expect(progressive.ok).toBe(true);
    expect(secondary.ok).toBe(true);
    if (!progressive.ok || !secondary.ok) return;

    expect(progressive.value.pitWithheld).toBe("18.50");
    expect(secondary.value.pitWithheld).toBe("47.50");
    expect(progressive.value.pitWithheld).not.toBe(secondary.value.pitWithheld);
  });

  it("applies flat 10% withholding for SECONDARY employer primacy", () => {
    const result = calculateEmployeeLine(
      {
        employmentType: "EMPLOYEE",
        employerPrimacy: "SECONDARY",
        grossSalaryOverride: "500.00",
        hours: { regularHours: "0" },
        rates: { hourlyRate: "10" },
        enforceMinimumGross: false,
      },
      snapshotPlain,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.pensionEmployee).toBe("25.00");
    expect(result.value.taxableIncome).toBe("475.00");
    expect(result.value.pitWithheld).toBe("47.50");
    expect(result.value.breakdown.atkRegime).toBe("SECONDARY_FLAT_10");
  });

  it("rejects gross below minimum wage when enforcement enabled", () => {
    const result = calculateEmployeeLine(
      {
        employmentType: "EMPLOYEE",
        employerPrimacy: "PRIMARY",
        grossSalaryOverride: "400.00",
        hours: { regularHours: "0" },
        rates: { hourlyRate: "10" },
        enforceMinimumGross: true,
      },
      snapshotPlain,
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues[0]?.code).toBe("BELOW_MINIMUM_GROSS");
  });

  it("computes overtime/holiday/weekend premiums additively", () => {
    const snap = kosovo2026AtkDefaults({
      premiumRules: {
        overtimeHourMultiplier: "1.5",
        holidayHourMultiplier: "2",
        weekendHourMultiplier: "1.25",
      },
    });

    const result = calculateEmployeeLine(
      {
        employmentType: "EMPLOYEE",
        employerPrimacy: "PRIMARY",
        hours: {
          regularHours: "10",
          overtimeHours: "2",
          holidayHours: "1",
          weekendHours: "3",
        },
        rates: { hourlyRate: "10" },
        enforceMinimumGross: false,
      },
      snap,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.breakdown.gross.regularPay).toBe("100.00");
    expect(result.value.breakdown.gross.overtimePay).toBe("30.00");
    expect(result.value.breakdown.gross.holidayPay).toBe("20.00");
    expect(result.value.breakdown.gross.weekendPay).toBe("37.50");
    expect(result.value.grossSalary).toBe("187.50");
  });
});

describe("calculateContractorLine", () => {
  it("defaults to exempt withholding (gross = net)", () => {
    const value = calculateContractorLine(
      {
        hours: { regularHours: "40" },
        rates: { hourlyRate: "20" },
      },
      snapshotWithStandardHours,
    );

    expect(value.grossSalary).toBe("800.00");
    expect(value.pitWithheld).toBe("0.00");
    expect(value.netPay).toBe("800.00");
    expect(value.breakdown.atkRegime).toBe("CONTRACTOR_EXEMPT");
  });

  it("supports SECONDARY_FLAT_10 contractor withholding opt-in", () => {
    const value = calculateContractorLine(
      {
        hours: { regularHours: "10" },
        rates: { hourlyRate: "50" },
        contractorWithholdingMode: "SECONDARY_FLAT_10",
        applyTrustContributions: true,
      },
      snapshotPlain,
    );

    expect(value.grossSalary).toBe("500.00");
    expect(value.pensionEmployee).toBe("25.00");
    expect(value.taxableIncome).toBe("475.00");
    expect(value.pitWithheld).toBe("47.50");
    expect(value.netPay).toBe("427.50");
  });

  it("surfaces validation failures via calculateContractorLineSafe", () => {
    const result = calculateContractorLineSafe(
      {
        hours: { regularHours: "-1" },
        rates: { hourlyRate: "10" },
      },
      snapshotPlain,
    );

    expect(result.ok).toBe(false);
  });
});
