import { describe, expect, it } from "vitest";
import {
  calculateAnnualLeaveEntitlement,
  type CalculateAnnualLeaveEntitlementInput,
} from "@/modules/leaves/engine/annual-leave-entitlement-engine";
import { deriveBaseAnnualDaysFromWorkweek } from "@/modules/leaves/engine/kosovo-annual-quota";
import { LeaveValidationCode } from "@/modules/leaves/engine/validation-result";

const baseInput: CalculateAnnualLeaveEntitlementInput = {
  workingDaysPerWeek: 5,
  companyAnnualDefault: null,
  policyMinimum: 20,
  hazardousMinimum: 30,
  tenureEveryYears: 5,
  tenureDaysPerBlock: 1,
  specialCategoryExtraDays: 2,
  firstYearGateMonths: 6,
  monthlyAccrualDays: 20 / 12,
  carryOverExpiryMonth: 6,
  carryOverExpiryDay: 30,
  splitLeaveMinWorkingDays: 10,
  enableTenureBonus: true,
  enableSpecialCategoryExtra: true,
  accrualMode: "MONTHLY",
  roundingMode: "NONE",
  uninterruptedMonths: 12,
  fullYearsOfService: 0,
  monthsWorkedInYear: 12,
  isHazardous: false,
  eligibleSpecialCategories: false,
  calculationDate: new Date(Date.UTC(2026, 5, 15)),
  usedApprovedDays: 0,
  pendingRequestedDays: 0,
  carriedOverFromPreviousYear: 0,
  carryOverExpiresAt: null,
  ledgerAccruedYtd: 0,
  approvedAnnualSegmentWorkingDays: [],
  hasMedicalOverlapAudit: false,
};

describe("deriveBaseAnnualDaysFromWorkweek", () => {
  it("uses 5-day workweek as 20 base days", () => {
    expect(deriveBaseAnnualDaysFromWorkweek(5, 20)).toBe(20);
  });

  it("uses 6-day workweek as 24 base days", () => {
    expect(deriveBaseAnnualDaysFromWorkweek(6, 20)).toBe(24);
  });
});

describe("calculateAnnualLeaveEntitlement", () => {
  it("derives 20 yearly entitlement for 5-day company", () => {
    const r = calculateAnnualLeaveEntitlement(baseInput);
    expect(r.baseAnnualDays).toBe(20);
    expect(r.yearlyEntitlementDays).toBe(20);
  });

  it("derives 24 yearly entitlement for 6-day company", () => {
    const r = calculateAnnualLeaveEntitlement({ ...baseInput, workingDaysPerWeek: 6 });
    expect(r.yearlyEntitlementDays).toBe(24);
  });

  it("adds +1 day for every 5 years of experience", () => {
    const r = calculateAnnualLeaveEntitlement({ ...baseInput, fullYearsOfService: 10 });
    expect(r.experienceExtraDays).toBe(2);
    expect(r.yearlyEntitlementDays).toBe(22);
  });

  it("adds +2 days for protected category employees", () => {
    const r = calculateAnnualLeaveEntitlement({ ...baseInput, eligibleSpecialCategories: true });
    expect(r.protectedCategoryExtraDays).toBe(2);
    expect(r.yearlyEntitlementDays).toBe(22);
  });

  it("applies hazardous minimum of 30 days", () => {
    const r = calculateAnnualLeaveEntitlement({ ...baseInput, isHazardous: true });
    expect(r.hazardousWorkMinimumApplied).toBe(true);
    expect(r.yearlyEntitlementDays).toBe(30);
  });

  it("limits first-year employee under 6 months to accrued balance", () => {
    const r = calculateAnnualLeaveEntitlement({
      ...baseInput,
      uninterruptedMonths: 3,
      monthsWorkedInYear: 3,
      accrualMode: "STATUTORY_FIRST_YEAR",
    });
    expect(r.accruedDaysToDate).toBeLessThan(20);
    expect(r.warnings.some((w) => w.code === LeaveValidationCode.FIRST_YEAR_ENTITLEMENT_WARN)).toBe(true);
  });

  it("uses statutory monthly accrual (~1.6667) for partial first year", () => {
    const r = calculateAnnualLeaveEntitlement({
      ...baseInput,
      uninterruptedMonths: 4,
      monthsWorkedInYear: 4,
      accrualMode: "STATUTORY_FIRST_YEAR",
    });
    expect(r.accruedDaysToDate).toBeGreaterThanOrEqual(6.6667);
    expect(r.accruedDaysToDate).toBeLessThan(20);
  });

  it("subtracts used approved days from remaining balance", () => {
    const r = calculateAnnualLeaveEntitlement({ ...baseInput, usedApprovedDays: 5 });
    expect(r.usedApprovedDays).toBe(5);
    expect(r.remainingAccruedDays).toBe(15);
  });

  it("tracks pending days separately from used days", () => {
    const r = calculateAnnualLeaveEntitlement({
      ...baseInput,
      usedApprovedDays: 8,
      pendingRequestedDays: 16,
    });
    expect(r.pendingRequestedDays).toBe(16);
    expect(r.remainingAccruedDays).toBe(12);
    expect(r.warnings.some((w) => w.message.includes("tejkalon bilancin e akumuluar"))).toBe(true);
  });

  it("zeros expired carry-over after June 30", () => {
    const r = calculateAnnualLeaveEntitlement({
      ...baseInput,
      carriedOverFromPreviousYear: 5,
      carryOverExpiresAt: new Date(Date.UTC(2026, 5, 29, 23, 59, 59, 999)),
      calculationDate: new Date(Date.UTC(2026, 6, 1)),
    });
    expect(r.carriedOverFromPreviousYear).toBe(0);
    expect(r.remainingAccruedDays).toBe(20);
  });

  it("includes active carry-over in remaining balance", () => {
    const r = calculateAnnualLeaveEntitlement({
      ...baseInput,
      carriedOverFromPreviousYear: 3,
      carryOverExpiresAt: new Date(Date.UTC(2026, 5, 30, 23, 59, 59, 999)),
      usedApprovedDays: 2,
    });
    expect(r.carriedOverFromPreviousYear).toBe(3);
    expect(r.remainingAccruedDays).toBe(21);
  });

  it("warns when split leave lacks a 10-day uninterrupted block", () => {
    const r = calculateAnnualLeaveEntitlement({
      ...baseInput,
      approvedAnnualSegmentWorkingDays: [4, 5, 3],
    });
    expect(r.warnings.some((w) => w.code === LeaveValidationCode.SPLIT_LEAVE_WARN)).toBe(true);
  });

  it("passes split leave when a 10-day block exists", () => {
    const r = calculateAnnualLeaveEntitlement({
      ...baseInput,
      approvedAnnualSegmentWorkingDays: [10, 4],
    });
    expect(r.warnings.some((w) => w.code === LeaveValidationCode.SPLIT_LEAVE_WARN)).toBe(false);
  });

  it("notes medical overlap audit when flagged", () => {
    const r = calculateAnnualLeaveEntitlement({ ...baseInput, hasMedicalOverlapAudit: true });
    expect(r.warnings.some((w) => w.code === "KOSOVO_ANNUAL_MEDICAL_OVERLAP")).toBe(true);
  });

  it("accrues entitlement-scaled + day-prorated and IGNORES the ledger (deterministic)", () => {
    const r = calculateAnnualLeaveEntitlement({
      ...baseInput,
      servedFractionToDate: 0.5,
      servedFractionToYearEnd: 1,
      ledgerAccruedYtd: 999, // must not affect the result anymore
    });
    expect(r.accruedDaysToDate).toBe(10); // 20 × 0.5
    expect(r.accruedDaysToYearEnd).toBe(20); // full year projected
  });

  it("scales accrual beyond 20 for a hazardous (30-day) employee — no flat 20 cap", () => {
    const r = calculateAnnualLeaveEntitlement({
      ...baseInput,
      isHazardous: true,
      servedFractionToDate: 1,
      servedFractionToYearEnd: 1,
    });
    expect(r.yearlyEntitlementDays).toBe(30);
    expect(r.accruedDaysToDate).toBe(30);
  });

  it("prorates a mid-month hire by served days (hired ~Apr 10 → ~266/365 of 20)", () => {
    const r = calculateAnnualLeaveEntitlement({
      ...baseInput,
      servedFractionToDate: 266 / 365,
      servedFractionToYearEnd: 266 / 365,
    });
    expect(r.accruedDaysToDate).toBeCloseTo(14.575, 2);
  });

  it("projects year-end on accrual-to-year-end, not full entitlement (mid-year hire)", () => {
    const r = calculateAnnualLeaveEntitlement({
      ...baseInput,
      servedFractionToDate: 0.5,
      servedFractionToYearEnd: 0.75,
      usedApprovedDays: 2,
    });
    expect(r.remainingAccruedDays).toBe(8); // 0 carry + 10 accrued − 2 used (available now)
    expect(r.remainingYearlyDays).toBe(13); // 0 carry + 15 accrued-by-year-end − 2 used
  });
});
