import { describe, expect, it } from "vitest";
import {
  BANK_ACCOUNT_NUMBER_MESSAGE,
  bankAccountNumberError,
  employeeUpsertSchema,
} from "@/modules/employees/validations/employee-schemas";

const base = {
  firstName: "Arta",
  lastName: "Krasniqi",
  personalId: "1234567890",
  jobTitleId: "clz0000000000000000000000",
  hireDate: "2026-01-01",
  status: "ACTIVE",
  employmentType: "EMPLOYEE",
  workArrangement: "ON_SITE",
  baseSalaryMonthly: 500,
  applyTrust: true,
  applyTax: true,
  documentsMissing: false,
};

const parse = (bankAccountIban: unknown) =>
  employeeUpsertSchema.safeParse({ ...base, bankAccountIban });

describe("bank account number — live message", () => {
  it("says nothing until something is typed", () => {
    expect(bankAccountNumberError("")).toBeNull();
    expect(bankAccountNumberError("   ")).toBeNull();
  });

  it("complains while the number is short", () => {
    expect(bankAccountNumberError("1")).toBe(BANK_ACCOUNT_NUMBER_MESSAGE);
    expect(bankAccountNumberError("123456789012345")).toBe(BANK_ACCOUNT_NUMBER_MESSAGE);
  });

  it("complains when one digit too many", () => {
    expect(bankAccountNumberError("12345678901234567")).toBe(BANK_ACCOUNT_NUMBER_MESSAGE);
  });

  it("goes quiet at exactly sixteen", () => {
    expect(bankAccountNumberError("1234567890123456")).toBeNull();
  });

  it("accepts the spaces people type when reading a number aloud", () => {
    expect(bankAccountNumberError("1234 5678 9012 3456")).toBeNull();
  });

  it("rejects letters, including the XK IBAN form", () => {
    expect(bankAccountNumberError("XK051212012345678906")).toBe(BANK_ACCOUNT_NUMBER_MESSAGE);
    expect(bankAccountNumberError("12345678901234AB")).toBe(BANK_ACCOUNT_NUMBER_MESSAGE);
  });
});

describe("bank account number — what the server accepts", () => {
  it("takes exactly sixteen digits", () => {
    const res = parse("1234567890123456");
    expect(res.success).toBe(true);
    if (res.success) expect(res.data.bankAccountIban).toBe("1234567890123456");
  });

  it("strips spaces rather than rejecting them", () => {
    const res = parse("1234 5678 9012 3456");
    expect(res.success).toBe(true);
    if (res.success) expect(res.data.bankAccountIban).toBe("1234567890123456");
  });

  it("still allows the field to be left empty", () => {
    for (const empty of ["", "   ", null, undefined]) {
      expect(parse(empty).success).toBe(true);
    }
  });

  it("refuses the shapes real records were found holding", () => {
    // All three exist on the dev database today: two short, one an XK IBAN.
    for (const bad of ["1234567890", "213215123456", "XK051212012345678906"]) {
      const res = parse(bad);
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error.issues.some((i) => i.message === BANK_ACCOUNT_NUMBER_MESSAGE)).toBe(true);
      }
    }
  });

  it("reports the failure against the bank field, so the form marks the right box", () => {
    const res = parse("123");
    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.error.issues[0]?.path).toEqual(["bankAccountIban"]);
    }
  });
});
