import { describe, expect, it } from "vitest";
import {
  applyFirstYearGateClamp,
  composeAnnualWorkingDayQuota,
  deriveBaseAnnualDaysFromWorkweek,
  fullYearsOfServiceUtc,
} from "@/modules/leaves/engine/kosovo-annual-quota";

const baseQuotaInput = {
  workingDaysPerWeek: 5,
  policyMinimum: 20,
  companyAnnualDefault: null as number | null,
  isHazardous: false,
  hazardousMinimum: 20,
  fullYearsOfService: 0,
  tenureEveryYears: 5,
  tenureDaysPerBlock: 1,
  enableTenure: true,
  specialExtraDays: 2,
  enableSpecialCategoryExtra: true,
  eligibleSpecialCategories: false,
};

describe("kosovo-annual-quota", () => {
  it("derives 20 base days from 5-day workweek", () => {
    expect(deriveBaseAnnualDaysFromWorkweek(5, 20)).toBe(20);
  });

  it("derives 24 base days from 6-day workweek", () => {
    const r = composeAnnualWorkingDayQuota({
      ...baseQuotaInput,
      workingDaysPerWeek: 6,
    });
    expect(r.breakdown.baseMinimum).toBe(24);
    expect(r.total).toBe(24);
  });

  it("raises hazardous floor above policy minimum", () => {
    const r = composeAnnualWorkingDayQuota({
      ...baseQuotaInput,
      isHazardous: true,
      hazardousMinimum: 30,
    });
    expect(r.total).toBe(30);
    expect(r.breakdown.afterHazardousBase).toBe(30);
  });

  it("adds tenure bonus per full blocks of service years", () => {
    const r = composeAnnualWorkingDayQuota({
      ...baseQuotaInput,
      isHazardous: false,
      fullYearsOfService: 11,
    });
    expect(r.breakdown.tenureBonus).toBe(2);
    expect(r.total).toBe(22);
  });

  it("scales entitlement before first-year gate months", () => {
    const gate = applyFirstYearGateClamp({
      fullAnnualQuota: 20,
      uninterruptedMonths: 3,
      gateMonths: 6,
    });
    expect(gate).toBe(10);
  });

  it("fullYearsOfServiceUtc handles anniversary boundary", () => {
    const anchor = new Date(Date.UTC(2020, 5, 15, 12, 0, 0, 0));
    const before = new Date(Date.UTC(2025, 5, 14, 12, 0, 0, 0));
    const on = new Date(Date.UTC(2025, 5, 15, 12, 0, 0, 0));
    expect(fullYearsOfServiceUtc(anchor, before)).toBe(4);
    expect(fullYearsOfServiceUtc(anchor, on)).toBe(5);
  });
});
