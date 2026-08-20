import { describe, expect, it } from "vitest";
import type { CompanyMembershipRole } from "@prisma/client";
import {
  ALL_CAPABILITIES,
  can,
  capabilitiesOf,
  capabilityDeniedMessage,
  type Capability,
} from "@/server/permissions";

const member = (role: CompanyMembershipRole) => ({ role, isPlatformAdmin: false });

/**
 * The matrix as the product owner agreed it. If a row here changes, that is a
 * product decision being made — not a refactor.
 */
const EXPECTED: Record<CompanyMembershipRole, Capability[]> = {
  OWNER: [
    "employees.write", "leave.write", "documents.write", "documents.sensitive", "timeclock.write",
    "payroll.prepare", "payroll.signoff", "company.settings",
  ],
  ADMIN: [
    "employees.write", "leave.write", "documents.write", "documents.sensitive", "timeclock.write",
    "payroll.prepare", "payroll.signoff", "company.settings",
  ],
  HR_MANAGER: [
    "employees.write", "leave.write", "documents.write", "documents.sensitive", "timeclock.write",
    "payroll.prepare",
  ],
  ACCOUNTANT: [
    "employees.write", "leave.write", "documents.write", "timeclock.write",
    "payroll.prepare", "payroll.signoff",
  ],
  READ_ONLY: [],
};

describe("company role capabilities", () => {
  it.each(Object.keys(EXPECTED) as CompanyMembershipRole[])(
    "%s holds exactly the agreed capabilities",
    (role) => {
      expect(capabilitiesOf(member(role))).toEqual(EXPECTED[role]);
    },
  );

  it("lets READ_ONLY change nothing at all", () => {
    for (const capability of ALL_CAPABILITIES) {
      expect(can(member("READ_ONLY"), capability)).toBe(false);
    }
  });

  it("keeps payroll sign-off away from HR_MANAGER but allows the preparation", () => {
    expect(can(member("HR_MANAGER"), "payroll.prepare")).toBe(true);
    expect(can(member("HR_MANAGER"), "payroll.signoff")).toBe(false);
  });

  it("gives ACCOUNTANT payroll sign-off and staff editing, but not company settings", () => {
    expect(can(member("ACCOUNTANT"), "payroll.signoff")).toBe(true);
    expect(can(member("ACCOUNTANT"), "employees.write")).toBe(true);
    expect(can(member("ACCOUNTANT"), "company.settings")).toBe(false);
  });

  it("reserves company settings for OWNER and ADMIN", () => {
    const allowed = (["OWNER", "ADMIN", "HR_MANAGER", "ACCOUNTANT", "READ_ONLY"] as const).filter(
      (role) => can(member(role), "company.settings"),
    );
    expect(allowed).toEqual(["OWNER", "ADMIN"]);
  });

  it("lets a platform admin through even with no membership", () => {
    for (const capability of ALL_CAPABILITIES) {
      expect(can({ role: null, isPlatformAdmin: true }, capability)).toBe(true);
    }
  });

  it("refuses a null role that is not a platform admin", () => {
    // Not a member of this company — the safe answer is no, never "undefined".
    for (const capability of ALL_CAPABILITIES) {
      expect(can({ role: null, isPlatformAdmin: false }, capability)).toBe(false);
    }
  });

  it("has an Albanian refusal for every capability", () => {
    for (const capability of ALL_CAPABILITIES) {
      const message = capabilityDeniedMessage(capability);
      expect(message.length).toBeGreaterThan(0);
      expect(message).toMatch(/Nuk keni leje/);
    }
  });
});
