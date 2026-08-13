import { describe, expect, it } from "vitest";
import {
  KOSOVO_BANKS,
  isKnownKosovoBank,
  normalizeKosovoBankName,
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

  it("maps every bank's own code and legal name back to itself", () => {
    for (const bank of KOSOVO_BANKS) {
      expect(normalizeKosovoBankName(bank.code)).toEqual({ value: bank.code, matched: true });
      expect(normalizeKosovoBankName(bank.officialName)).toEqual({
        value: bank.code,
        matched: true,
      });
    }
  });

  it("folds the spellings already sitting in real data", () => {
    // Every one of these is on the dev database today.
    expect(normalizeKosovoBankName("RBKO").value).toBe("Raiffeisen");
    expect(normalizeKosovoBankName("Raiffeisen Bank").value).toBe("Raiffeisen");
    expect(normalizeKosovoBankName("PCB").value).toBe("ProCredit");
    expect(normalizeKosovoBankName("pcb").value).toBe("ProCredit");
  });

  it("survives case, spacing, punctuation and Albanian diacritics", () => {
    expect(normalizeKosovoBankName("  banka   kombëtare tregtare  ").value).toBe("BKT");
    expect(normalizeKosovoBankName("BANKA KOMBETARE TREGTARE KOSOVE SH.A.").value).toBe("BKT");
    expect(normalizeKosovoBankName("nlb banka sh.a.").value).toBe("NLB");
    expect(normalizeKosovoBankName("Banka për Biznes").value).toBe("BpB");
    expect(normalizeKosovoBankName("ProCredit Bank Kosovo").value).toBe("ProCredit");
  });

  it("does not let the noise words swallow a bank whose name contains one", () => {
    // "Pribank" must not be shredded by stripping the token "bank".
    expect(normalizeKosovoBankName("Pribank SH.A.").value).toBe("Pribank");
    expect(normalizeKosovoBankName("pribank").value).toBe("Pribank");
  });

  it("keeps an unrecognised name instead of discarding it", () => {
    const odd = normalizeKosovoBankName("  Banka e Kursimeve  ");
    expect(odd.matched).toBe(false);
    expect(odd.value).toBe("Banka e Kursimeve");
  });

  it("treats blank and missing as no bank at all", () => {
    expect(normalizeKosovoBankName("")).toEqual({ value: null, matched: false });
    expect(normalizeKosovoBankName("   ")).toEqual({ value: null, matched: false });
    expect(normalizeKosovoBankName(null)).toEqual({ value: null, matched: false });
    expect(normalizeKosovoBankName(undefined)).toEqual({ value: null, matched: false });
  });

  it("never maps two different banks onto one another", () => {
    const seen = new Map<string, string>();
    for (const bank of KOSOVO_BANKS) {
      const folded = normalizeKosovoBankName(bank.officialName).value!;
      expect(seen.has(folded)).toBe(false);
      seen.set(folded, bank.code);
    }
  });

  it("excludes microfinance institutions, which the registry lists separately", () => {
    const codes = KOSOVO_BANKS.map((b) => b.code.toLowerCase());
    for (const mfi of ["kep", "afk", "finca", "grameen", "kosinvest", "kreditimi rural"]) {
      expect(codes).not.toContain(mfi);
    }
  });
});
