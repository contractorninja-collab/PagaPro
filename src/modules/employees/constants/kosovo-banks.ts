/**
 * The commercial banks licensed to operate in Kosovo.
 *
 * Taken from the Central Bank's own registry — "Lista e institucioneve
 * financiare të licencuara/regjistruara", 22 April 2026 — which lists exactly
 * these ten under "Bankat e Licencuara". Everything below that heading in the
 * same document (KEP Trust, AFK, FINCA, Grameen, KosInvest, Kreditimi Rural) is
 * a microfinance institution, not a bank, and does not belong here. Public
 * "banks in Kosovo" lists routinely conflate the two and still carry names that
 * closed years ago.
 *
 * `code` is what gets stored and shown — the short name people actually use,
 * because that is what a payroll clerk types and recognises. `officialName` is
 * the legal name for anywhere a document needs to be formal.
 *
 * Bank names drift (NLB traded as "NLB Prishtina" until recently; Credins and
 * Pribank are the newest licences), so this list is expected to be edited. It
 * is the single place to do that.
 */

export interface KosovoBank {
  /** Stored in Employee.bankName and shown in the picker. */
  code: string;
  /** Legal name exactly as the Central Bank registry writes it. */
  officialName: string;
}

export const KOSOVO_BANKS: readonly KosovoBank[] = [
  { code: "NLB", officialName: "NLB Banka SH.A." },
  { code: "BpB", officialName: "Banka për Biznes SH.A." },
  { code: "Banka Ekonomike", officialName: "Banka Ekonomike SH.A." },
  { code: "Raiffeisen", officialName: "Raiffeisen Bank Kosovo J.S.C." },
  { code: "ProCredit", officialName: "ProCredit Bank SH.A." },
  { code: "TEB", officialName: "TEB SH.A." },
  { code: "BKT", officialName: "Banka Kombëtare Tregtare Kosovë SH.A." },
  { code: "Ziraat", officialName: "Ziraat Bank Kosova SH.A." },
  { code: "Credins", officialName: "Banka Credins Kosovë SH.A." },
  { code: "Pribank", officialName: "Pribank SH.A." },
] as const;

const CODES = new Set(KOSOVO_BANKS.map((b) => b.code));

/** False for anything typed before the picker existed, or imported from a sheet. */
export function isKnownKosovoBank(value: string | null | undefined): boolean {
  return typeof value === "string" && CODES.has(value);
}

export function officialBankName(code: string | null | undefined): string | null {
  if (!code) return null;
  return KOSOVO_BANKS.find((b) => b.code === code)?.officialName ?? null;
}
