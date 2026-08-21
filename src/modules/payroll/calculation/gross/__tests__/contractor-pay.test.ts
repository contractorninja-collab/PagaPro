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
    // Without standardMonthlyHours no rate can be derived, so even premium
    // hours stay unpriced — the legacy fee-only behavior.
    expect(r.pay).toBe("350.00");
    expect(r.breakdown.premiumPay).toBe("0.00");
    expect(r.breakdown.regularHoursNotPriced).toBe("174");
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

describe("MONTHLY_FLAT + premium hours", () => {
  const RULES = {
    overtimeHourMultiplier: "1.3",
    weekendHourMultiplier: "1.5",
    holidayHourMultiplier: "1.5",
    nightHourMultiplier: "1.3",
    stackPolicy: "additive" as const,
  };

  it("pays the flat fee alone when no premium hours are entered", () => {
    const r = computeContractorPay({
      basis: "MONTHLY_FLAT",
      hourlyRate: "0",
      monthlyFlatAmount: "400",
      standardMonthlyHours: "174",
      hours: { regularHours: "160", overtimeHours: "0", weekendHours: "0", holidayHours: "0", nightHours: "0" },
      premiumRules: RULES,
    });
    expect(r.pay).toBe("400.00");
  });

  it("prices overtime on top of the fee at fee/standard-hours × multiplier", () => {
    // rate = 400/174 ≈ 2.2989; 10h OT at 1.3 → base 22.99 + uplift 6.90 = 29.89
    const r = computeContractorPay({
      basis: "MONTHLY_FLAT",
      hourlyRate: "0",
      monthlyFlatAmount: "400",
      standardMonthlyHours: "174",
      hours: { regularHours: "160", overtimeHours: "10", weekendHours: "0", holidayHours: "0", nightHours: "0" },
      premiumRules: RULES,
    });
    expect(r.pay).toBe("429.89");
    expect(r.warning).toBeNull();
  });

  it("night and weekend hours stack their uplifts additively like employees", () => {
    // rate ≈ 2.2989; 8h night: base 18.39 + 0.3×18.39=5.52 → 23.91; 8h weekend: base 18.39 + 0.5×18.39=9.20 → 27.59
    const r = computeContractorPay({
      basis: "MONTHLY_FLAT",
      hourlyRate: "0",
      monthlyFlatAmount: "400",
      standardMonthlyHours: "174",
      hours: { regularHours: "160", overtimeHours: "0", weekendHours: "8", holidayHours: "0", nightHours: "8" },
      premiumRules: RULES,
    });
    expect(Number(r.pay)).toBeCloseTo(400 + 23.91 + 27.59, 1);
  });

  it("stays fee-only when no standard hours are provided (legacy callers)", () => {
    const r = computeContractorPay({
      basis: "MONTHLY_FLAT",
      hourlyRate: "0",
      monthlyFlatAmount: "400",
      hours: { regularHours: "0", overtimeHours: "10", weekendHours: "0", holidayHours: "0", nightHours: "0" },
      premiumRules: RULES,
    });
    expect(r.pay).toBe("400.00");
  });
});
