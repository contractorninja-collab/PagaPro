import { describe, it, expect } from "vitest";
import { buildLibriPagaveRows, type LibriPagaveEntryInput } from "./libri-pagave-rows";

function entry(overrides: Partial<LibriPagaveEntryInput> = {}): LibriPagaveEntryInput {
  return {
    employerPrimacySnapshot: "PRIMARY",
    hourlyRate: "10.000000",
    actualRegularHours: "160.00",
    paidLeaveHours: "0.00",
    sickLeaveHours: "0.00",
    overtimeHours: "0.00",
    weekendHours: "0.00",
    holidayHours: "0.00",
    nightHours: "0.00",
    regularPay: "1600.00",
    paidLeavePay: "0.00",
    sickLeavePay: "0.00",
    overtimeAmount: "0.00",
    holidayAmount: "0.00",
    weekendAmount: "0.00",
    nightAmount: "0.00",
    bonuses: "0.00",
    unpaidLeaveDeduction: "0.00",
    otherDeductions: "0.00",
    salaryAdvanceDeduction: "0.00",
    grossSalary: "1600.00",
    taxableIncome: "1520.00",
    pitWithheld: "120.00",
    pensionEmployee: "80.00",
    pensionEmployer: "80.00",
    netPay: "1400.00",
    employee: {
      firstName: "Arjan",
      lastName: "Bajrami",
      applyTrust: true,
      applyTax: true,
      department: { name: "Shitje" },
      ...(overrides.employee ?? {}),
    },
    ...overrides,
  };
}

describe("buildLibriPagaveRows", () => {
  it("reads monetary columns from frozen engine values", () => {
    const r = buildLibriPagaveRows([entry()])[0]!;
    expect(r.regularGross).toBe(1600);
    expect(r.totalGross).toBe(1600);
    expect(r.employeeTrustAmount).toBe(80);
    expect(r.employerTrustAmount).toBe(80);
    expect(r.taxableIncome).toBe(1520);
    expect(r.taxAmount).toBe(120);
    expect(r.netToPay).toBe(1400);
    // trust % derived from the frozen amount ÷ gross (80/1600), not the live flag
    expect(r.employeeTrustPercent).toBe(0.05);
  });

  it("net columns reconcile: col23 = taxable − tax and col25 = col23 − advance", () => {
    const r = buildLibriPagaveRows([entry()])[0]!;
    expect(r.netIncome).toBe(r.taxableIncome - r.taxAmount); // 1400
    expect(r.netToPay).toBe(r.netIncome - r.advance); // 1400
  });

  it("folds otherDeductions into the advance column so net-to-pay stays correct", () => {
    // gross 1000, pension 50, pit 59, otherDeductions 100, advance 0 → stored net 791
    const r = buildLibriPagaveRows([
      entry({
        grossSalary: "1000.00",
        taxableIncome: "950.00",
        pitWithheld: "59.00",
        pensionEmployee: "50.00",
        pensionEmployer: "50.00",
        regularPay: "1000.00",
        otherDeductions: "100.00",
        salaryAdvanceDeduction: "0.00",
        netPay: "791.00",
      }),
    ])[0]!;
    expect(r.netIncome).toBe(891); // col21 − col22 = 950 − 59
    expect(r.advance).toBe(100); // otherDeductions folded into Avans
    expect(r.netToPay).toBe(791); // stored engine net
    expect(r.netToPay).toBe(r.netIncome - r.advance); // reconciles
  });

  it("combines a salary advance and otherDeductions into col24", () => {
    // gross 1600, pension 80, pit 120, otherDeductions 50, advance 100 → stored net 1250
    const r = buildLibriPagaveRows([
      entry({
        otherDeductions: "50.00",
        salaryAdvanceDeduction: "100.00",
        netPay: "1250.00",
      }),
    ])[0]!;
    expect(r.netIncome).toBe(1400); // 1520 − 120
    expect(r.advance).toBe(150); // 100 + 50
    expect(r.netToPay).toBe(1250);
    expect(r.netToPay).toBe(r.netIncome - r.advance);
  });

  it("sums stored premium amounts (not a hardcoded-multiplier recompute)", () => {
    const r = buildLibriPagaveRows([
      entry({
        overtimeHours: "10.00",
        holidayHours: "4.00",
        overtimeAmount: "130.00",
        holidayAmount: "60.00",
      }),
    ])[0]!;
    expect(r.premiumPay).toBe(190);
    expect(r.overtimeNightHours).toBe(10);
    expect(r.holidayWeekendHours).toBe(4);
  });

  it("REGRESSION: trust-exempt employee with overtime still shows premium pay", () => {
    // Pre-fix, premium pay was gated on pensionEmployee > 0; with applyTrust=false
    // the engine now stores pensionEmployee=0, which used to zero the premium column.
    const r = buildLibriPagaveRows([
      entry({
        overtimeHours: "10.00",
        overtimeAmount: "130.00",
        pensionEmployee: "0.00",
        pensionEmployer: "0.00",
        employee: {
          firstName: "Blerta",
          lastName: "Krasniqi",
          applyTrust: false,
          applyTax: true,
          department: null,
        },
      }),
    ])[0]!;
    expect(r.premiumPay).toBe(130);
    expect(r.employeeTrustPercent).toBe(0);
    expect(r.employeeTrustAmount).toBe(0);
  });

  it("derives trust % from the frozen amount even when the live flag disagrees (stale pre-P1a entry)", () => {
    // Entry frozen before applyTrust was honored: live flag false, but stored pension > 0.
    const r = buildLibriPagaveRows([
      entry({
        grossSalary: "1000.00",
        regularPay: "1000.00",
        taxableIncome: "950.00",
        pensionEmployee: "50.00",
        pensionEmployer: "50.00",
        pitWithheld: "59.00",
        netPay: "891.00",
        employee: {
          firstName: "Driton",
          lastName: "Gashi",
          applyTrust: false,
          applyTax: true,
          department: null,
        },
      }),
    ])[0]!;
    // % agrees with the euro amount (50/1000) instead of showing 0% next to €50
    expect(r.employeeTrustAmount).toBe(50);
    expect(r.employeeTrustPercent).toBe(0.05);
  });

  it("marks SECONDARY employer rows", () => {
    const r = buildLibriPagaveRows([entry({ employerPrimacySnapshot: "SECONDARY" })])[0]!;
    expect(r.isSecondary).toBe(true);
  });
});
