import { describe, expect, it } from "vitest";
import { computePremiumPays } from "./premiums";
import { D } from "../money/decimal";
import type { PremiumRules } from "../types";

/** Kosovo defaults from PayrollSettings: +30% overtime/night, +50% weekend/holiday. */
const RULES: PremiumRules = {
  overtimeHourMultiplier: "1.3",
  weekendHourMultiplier: "1.5",
  holidayHourMultiplier: "1.5",
  nightHourMultiplier: "1.3",
  stackPolicy: "additive",
};

const RATE = D("10");
const zero = D("0");

describe("computePremiumPays", () => {
  it("pays whole premium hours at the full multiplier (unchanged behaviour)", () => {
    const parts = computePremiumPays(RATE, RULES, D("10"), zero, zero, zero);
    // A hand-typed 10 overtime hours must still pay rate × 10 × 1.3.
    expect(parts.overtimePay.toFixed(2)).toBe("130.00");
    expect(parts.nightPay.toFixed(2)).toBe("0.00");
  });

  it("is unaffected when no stack hours are supplied", () => {
    const withoutStack = computePremiumPays(RATE, RULES, D("2"), D("1"), D("3"), D("4"));
    const withEmptyStack = computePremiumPays(RATE, RULES, D("2"), D("1"), D("3"), D("4"), {});
    expect(withEmptyStack.overtimePay.toFixed(2)).toBe(withoutStack.overtimePay.toFixed(2));
    expect(withEmptyStack.nightPay.toFixed(2)).toBe(withoutStack.nightPay.toFixed(2));
  });

  it("charges a stacked night hour the uplift only, not a second full rate", () => {
    // One Sunday 23:00 hour: weekend carries the base, night rides along.
    const parts = computePremiumPays(RATE, RULES, zero, zero, D("1"), zero, {
      nightStackHours: D("1"),
    });

    expect(parts.weekendPay.toFixed(2)).toBe("15.00"); // 1.5×
    expect(parts.nightPay.toFixed(2)).toBe("3.00"); // uplift 0.3× only

    const total = parts.weekendPay.plus(parts.nightPay);
    expect(total.toFixed(2)).toBe("18.00"); // 1.8× — not 2.8×
  });

  it("stacks overtime onto a weekend hour at the uplift", () => {
    const parts = computePremiumPays(RATE, RULES, zero, zero, D("1"), zero, {
      overtimeStackHours: D("1"),
    });

    expect(parts.weekendPay.toFixed(2)).toBe("15.00");
    expect(parts.overtimePay.toFixed(2)).toBe("3.00");
    expect(parts.weekendPay.plus(parts.overtimePay).toFixed(2)).toBe("18.00");
  });

  it("adds both uplifts to a Sunday night overtime hour", () => {
    const parts = computePremiumPays(RATE, RULES, zero, zero, D("1"), zero, {
      overtimeStackHours: D("1"),
      nightStackHours: D("1"),
    });

    // 1.5 base-with-premium + 0.3 overtime + 0.3 night = 2.1×
    const total = parts.weekendPay.plus(parts.overtimePay).plus(parts.nightPay);
    expect(total.toFixed(2)).toBe("21.00");
  });

  it("mixes full and stacked hours in the same bucket", () => {
    // 2 plain weekday night hours + 1 night hour that fell on a holiday.
    const parts = computePremiumPays(RATE, RULES, zero, D("1"), zero, D("2"), {
      nightStackHours: D("1"),
    });

    // 2 × 1.3 = 26.00 full, plus 1 × 0.3 = 3.00 uplift.
    expect(parts.nightPay.toFixed(2)).toBe("29.00");
    expect(parts.holidayPay.toFixed(2)).toBe("15.00");
  });
});
