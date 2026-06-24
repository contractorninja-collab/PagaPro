import { describe, expect, it } from "vitest";
import { parseReportFilters } from "@/modules/reports/services/report-registry";
import { contractExpiryFilterSchema, terminationMonthFilterSchema } from "@/modules/reports/validators/report-schemas";

describe("report validators", () => {
  it("parses termination month filters", () => {
    const x = terminationMonthFilterSchema.parse({ year: 2026, month: 5 });
    expect(x.month).toBe(5);
  });

  it("defaults contract expiry daysAhead", () => {
    const x = contractExpiryFilterSchema.parse({});
    expect(x.daysAhead).toBe(60);
  });

  it("throws when payroll id missing for payroll report", () => {
    expect(() => parseReportFilters("RAPORT_PAGAVE_MUJORE", {})).toThrow();
  });
});
