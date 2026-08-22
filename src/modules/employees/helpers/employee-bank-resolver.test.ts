import { afterEach, describe, expect, it, vi } from "vitest";
import { encryptField } from "@/lib/field-crypto";
import {
  resolveEmployeeBank,
  type BankAccountRecord,
  type EmployeeBankSubject,
} from "./employee-bank-resolver";

const NOW = new Date("2026-08-22T12:00:00.000Z");

function subject(over: Partial<EmployeeBankSubject> = {}): EmployeeBankSubject {
  return { firstName: "Arben", lastName: "Gashi", ...over };
}

function account(over: Partial<BankAccountRecord> = {}): BankAccountRecord {
  return {
    iban: "1212012345678906",
    bankName: "Raiffeisen",
    accountHolderName: null,
    bicSwift: null,
    isPrimary: true,
    validFrom: new Date("2026-01-01T00:00:00.000Z"),
    validTo: null,
    ...over,
  };
}

describe("resolveEmployeeBank — which account wins", () => {
  it("prefers the primary, currently valid account", () => {
    const r = resolveEmployeeBank(
      subject({
        bankAccountIban: "9999999999999999",
        bankAccounts: [
          account({ iban: "1111111111111111", isPrimary: false }),
          account({ iban: "2222222222222222", isPrimary: true }),
        ],
      }),
      NOW,
    );

    expect(r.iban).toBe("2222222222222222");
    expect(r.source).toBe("PRIMARY_ACTIVE");
  });

  it("sorts internally, so an unsorted list still picks the primary", () => {
    // The caller's orderBy must not decide the answer.
    const r = resolveEmployeeBank(
      subject({
        bankAccounts: [
          account({ iban: "1111111111111111", isPrimary: false }),
          account({ iban: "3333333333333333", isPrimary: false }),
          account({ iban: "2222222222222222", isPrimary: true }),
        ],
      }),
      NOW,
    );

    expect(r.iban).toBe("2222222222222222");
  });

  it("falls back to the newest account when the primary has expired", () => {
    const r = resolveEmployeeBank(
      subject({
        bankAccounts: [
          account({
            iban: "2222222222222222",
            isPrimary: true,
            validTo: new Date("2026-06-30T00:00:00.000Z"),
          }),
          account({
            iban: "4444444444444444",
            isPrimary: false,
            validFrom: new Date("2026-07-01T00:00:00.000Z"),
          }),
        ],
      }),
      NOW,
    );

    // Still resolvable, but flagged — nobody has confirmed this one is current.
    expect(r.iban).toBe("2222222222222222");
    expect(r.source).toBe("FALLBACK_ACCOUNT");
  });

  it("uses the legacy employee column when there is no account row", () => {
    const r = resolveEmployeeBank(
      subject({ bankAccountIban: "9999999999999999", bankName: "TEB" }),
      NOW,
    );

    expect(r.iban).toBe("9999999999999999");
    expect(r.bankName).toBe("TEB");
    expect(r.source).toBe("LEGACY_EMPLOYEE_FIELD");
  });

  it("reports NONE when the employee has no bank data at all", () => {
    const r = resolveEmployeeBank(subject(), NOW);

    expect(r.iban).toBeNull();
    expect(r.source).toBe("NONE");
  });

  it("treats an empty account number as absent rather than as an answer", () => {
    // An empty string is not nullish, so `??` chains used to return it verbatim.
    const r = resolveEmployeeBank(
      subject({
        bankAccountIban: "9999999999999999",
        bankAccounts: [account({ iban: "   " })],
      }),
      NOW,
    );

    expect(r.iban).toBe("9999999999999999");
    expect(r.source).toBe("LEGACY_EMPLOYEE_FIELD");
  });

  it("falls back to the employee's own name as account holder", () => {
    const r = resolveEmployeeBank(
      subject({ bankAccounts: [account({ accountHolderName: null })] }),
      NOW,
    );

    expect(r.accountHolder).toBe("Arben Gashi");
  });
});

describe("resolveEmployeeBank — encryption", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("decrypts a stored value with the configured key", () => {
    // 32 zero bytes, base64 — a throwaway key, never a real one.
    vi.stubEnv("FIELD_ENCRYPTION_KEY", Buffer.alloc(32).toString("base64"));
    const stored = encryptField("1212012345678906");
    expect(stored.startsWith("enc1:")).toBe(true);

    const r = resolveEmployeeBank(
      subject({ bankAccounts: [account({ iban: stored })] }),
      NOW,
    );

    expect(r.iban).toBe("1212012345678906");
  });

  it("yields the *** placeholder when the key cannot read the value", () => {
    vi.stubEnv("FIELD_ENCRYPTION_KEY", Buffer.alloc(32).toString("base64"));
    const stored = encryptField("1212012345678906");

    // Rotated to a different key: the row is intact but unreadable.
    vi.stubEnv("FIELD_ENCRYPTION_KEY", Buffer.alloc(32, 7).toString("base64"));
    const r = resolveEmployeeBank(
      subject({ bankAccounts: [account({ iban: stored })] }),
      NOW,
    );

    // Never throws — the payment list is responsible for catching this.
    expect(r.iban).toBe("***");
  });
});
