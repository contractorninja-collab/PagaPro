import { describe, expect, it } from "vitest";
import { D } from "@/modules/payroll/calculation/money/decimal";
import { buildBankPaymentSheet, type BankPaymentEntryInput } from "./bank-payment-rows";

function entry(over: Partial<BankPaymentEntryInput> = {}): BankPaymentEntryInput {
  return {
    firstName: "Arben",
    lastName: "Gashi",
    netPay: "845.50",
    bank: { iban: "1212012345678906", source: "PRIMARY_ACTIVE" },
    ...over,
  };
}

describe("buildBankPaymentSheet — classification", () => {
  it("pays a clean row and leaves its note empty", () => {
    const s = buildBankPaymentSheet([entry()]);

    expect(s.payable).toHaveLength(1);
    expect(s.blocked).toHaveLength(0);
    expect(s.payable[0]!.accountNumber).toBe("1212012345678906");
    expect(s.payable[0]!.note).toBe("");
    expect(s.payableTotal).toBe("845.50");
  });

  it("classifies *** as unreadable, NOT as a format error", () => {
    // The ordering regression: *** means the encryption key is broken, which is
    // an ops problem. Calling it a format error sends HR to retype everything.
    const s = buildBankPaymentSheet([
      entry({ bank: { iban: "***", source: "PRIMARY_ACTIVE" } }),
    ]);

    expect(s.blocked[0]!.issue).toBe("UNREADABLE_ACCOUNT");
    expect(s.blocked[0]!.issue).not.toBe("INVALID_ACCOUNT_FORMAT");
    expect(s.blocked[0]!.accountNumber).toBe("E PALEXUESHME");
    expect(s.unreadableCount).toBe(1);
  });

  it("never prints *** as if it were an account number", () => {
    const s = buildBankPaymentSheet([
      entry({ bank: { iban: "***", source: "PRIMARY_ACTIVE" } }),
    ]);

    expect(s.blocked[0]!.accountNumber).not.toContain("*");
    expect(s.payable).toHaveLength(0);
  });

  it("keeps a malformed legacy number out of the account column", () => {
    // A real 12-digit value found in the register before the rule existed.
    const s = buildBankPaymentSheet([
      entry({ bank: { iban: "213215123456", source: "PRIMARY_ACTIVE" } }),
    ]);

    expect(s.blocked[0]!.issue).toBe("INVALID_ACCOUNT_FORMAT");
    expect(s.blocked[0]!.accountNumber).toBe("FORMAT I PASAKTË");
    // Visible for fixing, but not in a cell anyone would paste into a bank file.
    expect(s.blocked[0]!.note).toContain("213215123456");
  });

  it("normalizes a Kosovo IBAN and a spaced number to the bare 16 digits", () => {
    const s = buildBankPaymentSheet([
      entry({ bank: { iban: "XK051212012345678906", source: "PRIMARY_ACTIVE" } }),
      entry({ bank: { iban: "1212 0123 4567 8906", source: "PRIMARY_ACTIVE" } }),
    ]);

    expect(s.payable.map((r) => r.accountNumber)).toEqual([
      "1212012345678906",
      "1212012345678906",
    ]);
  });

  it("blocks a missing account", () => {
    const s = buildBankPaymentSheet([entry({ bank: { iban: null, source: "NONE" } })]);

    expect(s.blocked[0]!.issue).toBe("MISSING_ACCOUNT");
    expect(s.blockedCount).toBe(1);
  });

  it("warns, but still pays, when the account came from a fallback", () => {
    const s = buildBankPaymentSheet([
      entry({ bank: { iban: "1212012345678906", source: "LEGACY_EMPLOYEE_FIELD" } }),
    ]);

    expect(s.payable).toHaveLength(1);
    expect(s.payable[0]!.note).not.toBe("");
  });
});

describe("buildBankPaymentSheet — zero and negative net", () => {
  it("counts a negative net as a problem", () => {
    const s = buildBankPaymentSheet([entry({ netPay: "-40.00" })]);

    expect(s.blocked[0]!.issue).toBe("NEGATIVE_NET");
    expect(s.blockedCount).toBe(1);
  });

  it("does not raise an alarm for someone simply not paid this month", () => {
    // Unpaid leave all month is correct, not a fault — folding it into the
    // alarm count would train people to ignore the count.
    const s = buildBankPaymentSheet([entry({ netPay: "0.00" })]);

    expect(s.blocked[0]!.issue).toBe("ZERO_NET");
    expect(s.zeroNetCount).toBe(1);
    expect(s.blockedCount).toBe(0);
  });

  it("does not blame a zero-net employee for a missing account", () => {
    const s = buildBankPaymentSheet([
      entry({ netPay: "0.00", bank: { iban: null, source: "NONE" } }),
    ]);

    expect(s.blocked[0]!.issue).toBe("ZERO_NET");
    expect(s.blockedCount).toBe(0);
  });
});

describe("buildBankPaymentSheet — the reconciliation invariant", () => {
  it("payable + blocked equals every euro that went in", () => {
    // The invariant the whole design rests on: no row is ever dropped.
    const entries = [
      entry({ netPay: "845.50" }),
      entry({ netPay: "1200.25", bank: { iban: null, source: "NONE" } }),
      entry({ netPay: "0.00" }),
      entry({ netPay: "-40.00" }),
      entry({ netPay: "333.33", bank: { iban: "***", source: "PRIMARY_ACTIVE" } }),
      entry({ netPay: "612.10" }),
    ];

    const s = buildBankPaymentSheet(entries);
    const expected = entries.reduce((acc, e) => acc.plus(D(e.netPay)), D("0"));

    expect(D(s.payableTotal).plus(D(s.blockedTotal)).toFixed(2)).toBe(expected.toFixed(2));
    expect(s.grandTotal).toBe(expected.toFixed(2));
    expect(s.payable.length + s.blocked.length).toBe(entries.length);
    expect(s.headcount).toBe(entries.length);
  });

  it("totals in decimal, not floating point", () => {
    const s = buildBankPaymentSheet([
      entry({ netPay: "0.10" }),
      entry({ netPay: "0.20" }),
      entry({ netPay: "0.30" }),
    ]);

    // A Number accumulator gives 0.6000000000000001 here.
    expect(s.payableTotal).toBe("0.60");
  });

  it("numbers rows across the whole list, so the payable block shows the gap", () => {
    const s = buildBankPaymentSheet([
      entry({ netPay: "100.00" }),
      entry({ netPay: "200.00", bank: { iban: null, source: "NONE" } }),
      entry({ netPay: "300.00" }),
      entry({ netPay: "400.00" }),
    ]);

    expect(s.payable.map((r) => r.nr)).toEqual([1, 3, 4]);
    expect(s.blocked.map((r) => r.nr)).toEqual([2]);
  });

  it("handles an empty period without crashing", () => {
    const s = buildBankPaymentSheet([]);

    expect(s.headcount).toBe(0);
    expect(s.payableTotal).toBe("0.00");
    expect(s.grandTotal).toBe("0.00");
  });

  it("reports how many rows had a stored account, for the key-outage check", () => {
    const s = buildBankPaymentSheet([
      entry({ bank: { iban: "***", source: "PRIMARY_ACTIVE" } }),
      entry({ bank: { iban: "***", source: "PRIMARY_ACTIVE" } }),
      entry({ bank: { iban: null, source: "NONE" } }),
    ]);

    // Every readable-account row is unreadable => the key is the problem.
    expect(s.unreadableCount).toBe(2);
    expect(s.withStoredAccountCount).toBe(2);
  });
});
