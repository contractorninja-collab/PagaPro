import { describe, expect, it } from "vitest";
import { computeContractorPay } from "../contractor-pay";
import type { HourBreakdown, PremiumRules } from "../../types";

const RULES: PremiumRules = {
  overtimeHourMultiplier: "1.3",
  weekendHourMultiplier: "1.5",
  holidayHourMultiplier: "1.5",
  nightHourMultiplier: "1.3",
  stackPolicy: "additive",
};

const NO_HOURS: HourBreakdown = {
  regularHours: "0",
  overtimeHours: "0",
  weekendHours: "0",
  holidayHours: "0",
  nightHours: "0",
};

describe("computeContractorPay — MONTHLY_FLAT", () => {
  it("pays exactly the agreed fee", () => {
    const r = computeContractorPay({
      basis: "MONTHLY_FLAT",
      hourlyRate: "0",
      monthlyFlatAmount: "350",
      hours: NO_HOURS,
      premiumRules: RULES,
    });
    expect(r.pay).toBe("350.00");
    expect(r.warning).toBeNull();
  });

  it("ignores hours entirely — that is what flat means", () => {
    const worked: HourBreakdown = {
      regularHours: "174",
      overtimeHours: "20",
      weekendHours: "16",
      holidayHours: "8",
      nightHours: "10",
    };
    const r = computeContractorPay({
      basis: "MONTHLY_FLAT",
      hourlyRate: "9.99",
      monthlyFlatAmount: "350",
      hours: worked,
      premiumRules: RULES,
    });
    expect(r.pay).toBe("350.00");
    expect(r.breakdown.hoursNotPriced).toEqual(worked);
  });

  it("rounds half-up to cents", () => {
    const r = computeContractorPay({
      basis: "MONTHLY_FLAT",
      hourlyRate: "0",
      monthlyFlatAmount: "350.005",
      hours: NO_HOURS,
      premiumRules: RULES,
    });
    expect(r.pay).toBe("350.01");
  });

  it("flags a missing amount instead of paying zero silently", () => {
    const r = computeContractorPay({
      basis: "MONTHLY_FLAT",
      hourlyRate: "5",
      monthlyFlatAmount: "0",
      hours: NO_HOURS,
      premiumRules: RULES,
    });
    expect(r.pay).toBe("0.00");
    expect(r.warning).toBe("MISSING_MONTHLY_AMOUNT");
  });
});

describe("computeContractorPay — HOURLY", () => {
  it("pays hours × rate", () => {
    const r = computeContractorPay({
      basis: "HOURLY",
      hourlyRate: "5",
      monthlyFlatAmount: "0",
      hours: { ...NO_HOURS, regularHours: "160" },
      premiumRules: RULES,
    });
    expect(r.pay).toBe("800.00");
  });

  it("applies the premium multipliers", () => {
    // 100 × 5 = 500 regular; 10 overtime at ×1.3 = 65; 8 weekend at ×1.5 = 60.
    const r = computeContractorPay({
      basis: "HOURLY",
      hourlyRate: "5",
      monthlyFlatAmount: "0",
      hours: { ...NO_HOURS, regularHours: "100", overtimeHours: "10", weekendHours: "8" },
      premiumRules: RULES,
    });
    expect(r.pay).toBe("625.00");
  });

  it("ignores the monthly amount on this basis", () => {
    const r = computeContractorPay({
      basis: "HOURLY",
      hourlyRate: "5",
      monthlyFlatAmount: "9999",
      hours: { ...NO_HOURS, regularHours: "10" },
      premiumRules: RULES,
    });
    expect(r.pay).toBe("50.00");
  });

  it("flags a missing rate rather than throwing", () => {
    const r = computeContractorPay({
      basis: "HOURLY",
      hourlyRate: "0",
      monthlyFlatAmount: "350",
      hours: { ...NO_HOURS, regularHours: "160" },
      premiumRules: RULES,
    });
    expect(r.pay).toBe("0.00");
    expect(r.warning).toBe("MISSING_HOURLY_RATE");
  });
});
