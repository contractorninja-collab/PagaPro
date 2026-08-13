import { describe, expect, it } from "vitest";
import {
  KOSOVO_BANKS,
  isKnownKosovoBank,
  officialBankName,
} from "@/modules/employees/constants/kosovo-banks";

/**
 * Pinned to the Central Bank registry of 22 April 2026. If a licence is granted
 * or withdrawn, this test is the reminder that the list is a real-world fact
 * and not a free-form UI array.
 */
describe("Kosovo banks", () => {
  it("carries the ten licensed commercial banks, in registry order", () => {
    expect(KOSOVO_BANKS.map((b) => b.code)).toEqual([
      "NLB",
      "BpB",
      "Banka Ekonomike",
      "Raiffeisen",
      "ProCredit",
      "TEB",
      "BKT",
      "Ziraat",
      "Credins",
      "Pribank",
    ]);
  });

  it("keeps every legal name, for documents that must be formal", () => {
    expect(officialBankName("BKT")).toBe("Banka Kombëtare Tregtare Kosovë SH.A.");
    expect(officialBankName("Raiffeisen")).toBe("Raiffeisen Bank Kosovo J.S.C.");
    expect(KOSOVO_BANKS.every((b) => b.officialName.trim().length > 0)).toBe(true);
  });

  it("has no duplicate codes, so a stored value maps to one bank", () => {
    expect(new Set(KOSOVO_BANKS.map((b) => b.code)).size).toBe(KOSOVO_BANKS.length);
  });

  it("recognises a stored code and rejects the free text that predates the list", () => {
    expect(isKnownKosovoBank("ProCredit")).toBe(true);
    // Real values found on the dev database before the picker existed.
    expect(isKnownKosovoBank("RBKO")).toBe(false);
    expect(isKnownKosovoBank("pcb")).toBe(false);
    expect(isKnownKosovoBank("Raiffeisen Bank")).toBe(false);
    expect(isKnownKosovoBank(null)).toBe(false);
    expect(isKnownKosovoBank("")).toBe(false);
  });

  it("excludes microfinance institutions, which the registry lists separately", () => {
    const codes = KOSOVO_BANKS.map((b) => b.code.toLowerCase());
    for (const mfi of ["kep", "afk", "finca", "grameen", "kosinvest", "kreditimi rural"]) {
      expect(codes).not.toContain(mfi);
    }
  });
});
