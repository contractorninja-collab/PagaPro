import { describe, expect, it } from "vitest";
import { canImportEmployees } from "@/modules/employees/services/employee-import-access";

describe("employee import access", () => {
  it.each(["OWNER", "ADMIN", "HR_MANAGER"] as const)("allows %s", (role) => {
    expect(canImportEmployees({ role, isPlatformAdmin: false })).toBe(true);
  });

  it.each(["ACCOUNTANT", "READ_ONLY"] as const)("denies %s", (role) => {
    expect(canImportEmployees({ role, isPlatformAdmin: false })).toBe(false);
  });

  it("allows platform administrators", () => {
    expect(canImportEmployees({ role: null, isPlatformAdmin: true })).toBe(true);
  });
});
