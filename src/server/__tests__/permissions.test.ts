import { describe, expect, it } from "vitest";
import type { CompanyMembershipRole, SalaryAccess } from "@prisma/client";
import {
  ALL_CAPABILITIES,
  can,
  capabilitiesOf,
  capabilityDeniedMessage,
  type Capability,
} from "@/server/permissions";

const member = (role: CompanyMembershipRole, salaryAccess: SalaryAccess = "FULL") => ({
  role,
  isPlatformAdmin: false,
  salaryAccess,
});

/** The write capabilities — everything except the two salary read gates. */
const WRITE_CAPABILITIES = ALL_CAPABILITIES.filter(
  (c) => c !== "salaries.view" && c !== "salaries.full",
);

/**
 * The matrix as the product owner agreed it. If a row here changes, that is a
 * product decision being made — not a refactor. Every role additionally holds
 * salaries.view + salaries.full at the default FULL tier — salary visibility
 * comes from the membership tier, not the role.
 */
const EXPECTED: Record<CompanyMembershipRole, Capability[]> = {
  OWNER: [
    "employees.write", "leave.write", "documents.write", "documents.sensitive", "timeclock.write",
    "payroll.prepare", "payroll.signoff", "company.settings", "salaries.view", "salaries.full",
  ],
  ADMIN: [
    "employees.write", "leave.write", "documents.write", "documents.sensitive", "timeclock.write",
    "payroll.prepare", "payroll.signoff", "company.settings", "salaries.view", "salaries.full",
  ],
  HR_MANAGER: [
    "employees.write", "leave.write", "documents.write", "documents.sensitive", "timeclock.write",
    "payroll.prepare", "salaries.view", "salaries.full",
  ],
  ACCOUNTANT: [
    "employees.write", "leave.write", "documents.write", "timeclock.write",
    "payroll.prepare", "payroll.signoff", "salaries.view", "salaries.full",
  ],
  READ_ONLY: ["salaries.view", "salaries.full"],
};

describe("company role capabilities", () => {
  it.each(Object.keys(EXPECTED) as CompanyMembershipRole[])(
    "%s holds exactly the agreed capabilities",
    (role) => {
      expect(capabilitiesOf(member(role))).toEqual(EXPECTED[role]);
    },
  );

  it("lets READ_ONLY change nothing at all — but read salaries by default", () => {
    for (const capability of WRITE_CAPABILITIES) {
      expect(can(member("READ_ONLY"), capability)).toBe(false);
    }
    // The module's doctrine: reads are ungated; READ_ONLY sees everything.
    expect(can(member("READ_ONLY"), "salaries.view")).toBe(true);
    expect(can(member("READ_ONLY"), "salaries.full")).toBe(true);
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
      expect(can({ role: null, isPlatformAdmin: true, salaryAccess: "FULL" }, capability)).toBe(true);
    }
  });

  it("refuses a null role that is not a platform admin", () => {
    // Not a member of this company — the safe answer is no, never "undefined".
    for (const capability of ALL_CAPABILITIES) {
      expect(can({ role: null, isPlatformAdmin: false, salaryAccess: "FULL" }, capability)).toBe(false);
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

describe("salary visibility tiers", () => {
  it("NONE sees no amounts but keeps every role capability", () => {
    const blindHr = member("HR_MANAGER", "NONE");
    expect(can(blindHr, "salaries.view")).toBe(false);
    expect(can(blindHr, "salaries.full")).toBe(false);
    // The workflow split is untouched: hours in, Llogarit, Valido still work.
    expect(can(blindHr, "payroll.prepare")).toBe(true);
    expect(can(blindHr, "employees.write")).toBe(true);
  });

  it("STANDARD sees per-employee amounts but never aggregates", () => {
    const hrAdmin = member("HR_MANAGER", "STANDARD");
    expect(can(hrAdmin, "salaries.view")).toBe(true);
    // A total minus the visible rows would reveal the confidential remainder.
    expect(can(hrAdmin, "salaries.full")).toBe(false);
  });

  it("FULL sees everything — the default, so existing tenants are unchanged", () => {
    const finance = member("ACCOUNTANT", "FULL");
    expect(can(finance, "salaries.view")).toBe(true);
    expect(can(finance, "salaries.full")).toBe(true);
  });

  it("the tier applies to every role, READ_ONLY included", () => {
    expect(can(member("READ_ONLY", "NONE"), "salaries.view")).toBe(false);
    expect(can(member("OWNER", "NONE"), "salaries.view")).toBe(false);
  });

  it("a platform admin is never masked, whatever the tier says", () => {
    expect(can({ role: null, isPlatformAdmin: true, salaryAccess: "NONE" }, "salaries.full")).toBe(true);
  });

  it("the tier grants nothing beyond salary visibility", () => {
    // A FULL tier on READ_ONLY must not leak any write capability.
    for (const capability of WRITE_CAPABILITIES) {
      expect(can(member("READ_ONLY", "FULL"), capability)).toBe(false);
    }
  });
});
