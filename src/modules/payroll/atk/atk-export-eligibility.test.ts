import { describe, expect, it } from "vitest";
import {
  atkGenerationBlock,
  canGenerateAtkExport,
  isAtkStatusEligible,
  isPayrollFrozen,
} from "./atk-export-eligibility";

describe("ATK export eligibility", () => {
  it("blocks a draft or a payroll still under review", () => {
    expect(canGenerateAtkExport({ status: "DRAFT", hasActiveExport: false })).toBe(false);
    expect(canGenerateAtkExport({ status: "REVIEWED", hasActiveExport: false })).toBe(false);
    expect(atkGenerationBlock({ status: "DRAFT", hasActiveExport: false })).toBe("STATUS");
  });

  it("allows an archived payroll to produce its filing", () => {
    // The regression this exists for: a month is filed with ATK *after* it is
    // closed, so archiving must not lock the export away.
    expect(canGenerateAtkExport({ status: "ARCHIVED", hasActiveExport: false })).toBe(true);
  });

  it("allows approved and locked payrolls with no export yet", () => {
    expect(canGenerateAtkExport({ status: "APPROVED", hasActiveExport: false })).toBe(true);
    expect(canGenerateAtkExport({ status: "LOCKED", hasActiveExport: false })).toBe(true);
  });

  it("lets an approved payroll regenerate, replacing the previous file", () => {
    expect(canGenerateAtkExport({ status: "APPROVED", hasActiveExport: true })).toBe(true);
  });

  it("refuses a second file once the figures are frozen", () => {
    for (const status of ["LOCKED", "ARCHIVED"] as const) {
      expect(canGenerateAtkExport({ status, hasActiveExport: true })).toBe(false);
      expect(atkGenerationBlock({ status, hasActiveExport: true })).toBe("ALREADY_GENERATED");
    }
  });

  it("treats locked and archived as equally final", () => {
    expect(isPayrollFrozen("LOCKED")).toBe(true);
    expect(isPayrollFrozen("ARCHIVED")).toBe(true);
    expect(isPayrollFrozen("APPROVED")).toBe(false);
  });

  it("counts all three post-approval states as eligible", () => {
    expect(isAtkStatusEligible("APPROVED")).toBe(true);
    expect(isAtkStatusEligible("LOCKED")).toBe(true);
    expect(isAtkStatusEligible("ARCHIVED")).toBe(true);
    expect(isAtkStatusEligible("DRAFT")).toBe(false);
  });
});
