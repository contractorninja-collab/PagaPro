import { describe, expect, it } from "vitest";
import { terminationCreateSchema } from "@/modules/terminations/validators/termination-schemas";

describe("terminationCreateSchema", () => {
  const base = {
    employeeId: "emp1",
    type: "LARGIM_VULLNETAR" as const,
    terminationDate: new Date("2026-05-01"),
    lastWorkingDay: new Date("2026-05-15"),
    finalPayrollRequired: true,
  };

  it("accepts valid resignation", () => {
    const r = terminationCreateSchema.safeParse(base);
    expect(r.success).toBe(true);
  });

  it("requires reason for dismissal by employer", () => {
    const r = terminationCreateSchema.safeParse({
      ...base,
      type: "NGA_PUNEDHENESI",
      reason: "",
    });
    expect(r.success).toBe(false);
  });

  it("requires details for MANUAL", () => {
    const r = terminationCreateSchema.safeParse({
      ...base,
      type: "MANUAL",
      details: "   ",
    });
    expect(r.success).toBe(false);
  });
});
