import { describe, expect, it } from "vitest";
import { statutorySickLeavePayPercent } from "@/modules/payroll/calculation/legislation/sick-pay";

describe("statutorySickLeavePayPercent — Neni 60: 100% dysheme ligjore", () => {
  it("keeps 100% as-is", () => {
    expect(statutorySickLeavePayPercent("1")).toBe("1");
  });

  it("raises sub-statutory values (70%) to 100%", () => {
    expect(statutorySickLeavePayPercent("0.7")).toBe("1");
  });

  it("raises 0 to 100%", () => {
    expect(statutorySickLeavePayPercent("0")).toBe("1");
  });

  it("allows more generous employers (>100%)", () => {
    expect(statutorySickLeavePayPercent("1.2")).toBe("1.2");
  });

  it("defaults missing/invalid values to 100%", () => {
    expect(statutorySickLeavePayPercent(null)).toBe("1");
    expect(statutorySickLeavePayPercent(undefined)).toBe("1");
    expect(statutorySickLeavePayPercent("")).toBe("1");
    expect(statutorySickLeavePayPercent("abc")).toBe("1");
    expect(statutorySickLeavePayPercent("-0.5")).toBe("1");
  });
});
