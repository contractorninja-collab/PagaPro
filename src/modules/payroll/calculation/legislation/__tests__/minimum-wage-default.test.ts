import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { KOSOVO_MINIMUM_MONTHLY_GROSS } from "@/modules/payroll/calculation/legislation/minimum-wage";
import { kosovo2026AtkDefaults } from "@/modules/payroll/calculation/legislation/defaults";

/**
 * There used to be four minimum-wage figures in this codebase — 350 at
 * provisioning, 425 and 500 as settings fallbacks, 450 in the engine — and they
 * disagreed, so a company that never opened Konfigurimet had its warnings
 * measured against a number nobody had chosen. These tests exist to keep that
 * from happening again, not to assert the amount itself.
 */
describe("the minimum wage has one source", () => {
  it("is the figure the engine falls back to with no snapshot", () => {
    expect(kosovo2026AtkDefaults().minimumMonthlyGross).toBe(KOSOVO_MINIMUM_MONTHLY_GROSS);
  });

  it("is what a newly provisioned company gets in its parameter set", () => {
    const src = readFileSync("src/modules/admin/services/company-provisioning.ts", "utf8");
    expect(src).toContain("minimumMonthlyWage: KOSOVO_MINIMUM_MONTHLY_GROSS");
    expect(src).not.toMatch(/minimumMonthlyWage:\s*"\d/);
  });

  it("is what the settings service falls back to when Konfigurimet is unset", () => {
    const src = readFileSync("src/modules/payroll/services/payroll-settings-service.ts", "utf8");
    // Both the read path and the sync path.
    expect(src.match(/\?\? KOSOVO_MINIMUM_MONTHLY_GROSS/g) ?? []).toHaveLength(2);
    // No stray literal fallback for either minimum field.
    expect(src).not.toMatch(/minimumSalary\w*\s*(\?\?|\?\.toString\(\)\s*\?\?)\s*"\d/);
  });

  it("is a plain positive decimal string, so Prisma.Decimal accepts it", () => {
    expect(KOSOVO_MINIMUM_MONTHLY_GROSS).toMatch(/^\d+(\.\d+)?$/);
    expect(Number(KOSOVO_MINIMUM_MONTHLY_GROSS)).toBeGreaterThan(0);
  });
});
