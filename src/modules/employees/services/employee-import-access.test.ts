import { describe, expect, it } from "vitest";
import { canImportEmployees } from "@/modules/employees/services/employee-import-access";

/**
 * ACCOUNTANT moved from denied to allowed here — a deliberate product decision,
 * not a test bent to fit the code. The predicate used to carry its own role list
 * (OWNER/ADMIN/HR_MANAGER) which disagreed with the agreed matrix once
 * ACCOUNTANT was given employees.write, and two lists meant two answers to one
 * question. It now defers to src/server/permissions.ts.
 */
describe("employee import access", () => {
  it.each(["OWNER", "ADMIN", "HR_MANAGER", "ACCOUNTANT"] as const)("allows %s", (role) => {
    expect(canImportEmployees({ role, isPlatformAdmin: false, salaryAccess: "FULL" })).toBe(true);
  });

  it("denies READ_ONLY", () => {
    expect(canImportEmployees({ role: "READ_ONLY", isPlatformAdmin: false, salaryAccess: "FULL" })).toBe(false);
  });

  it("denies a non-member", () => {
    expect(canImportEmployees({ role: null, isPlatformAdmin: false, salaryAccess: "FULL" })).toBe(false);
  });

  it("allows platform administrators", () => {
    expect(canImportEmployees({ role: null, isPlatformAdmin: true, salaryAccess: "FULL" })).toBe(true);
  });
});
