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

/**
 * Words that carry no information about *which* bank this is. Dropping them
 * lets "Raiffeisen Bank Kosovo J.S.C.", "Raiffeisen" and "raiffeisen bank"
 * all land on the same entry. Only whole tokens are dropped, so "Pribank" and
 * "bpbbank" survive intact.
 */
const NOISE_TOKENS = new Set([
  "bank", "banka", "bankasi", "sh", "a", "sha", "shpk", "jsc", "j", "s", "c",
  "kosova", "kosove", "kosovo", "ks", "xk", "dega", "deget", "filiala",
]);

/** Lowercase, unaccent, strip punctuation and noise words. */
function fold(raw: string): string {
  return raw
    .toLocaleLowerCase("sq-AL")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .split(" ")
    .filter((t) => t.length > 0 && !NOISE_TOKENS.has(t))
    .join(" ");
}

/**
 * What a spreadsheet actually says, per bank.
 *
 * The official name and the short code are folded in automatically; these are
 * the extras — trading names, local abbreviations, and the spellings already
 * sitting in real data ("RBKO", "PCB", "Raiffeisen Bank").
 */
const ALIASES: Record<string, readonly string[]> = {
  NLB: ["nlb", "nlb prishtina", "nlb banka prishtina", "nova ljubljanska banka"],
  BpB: ["bpb", "bpbbank", "banka per biznes", "per biznes"],
  "Banka Ekonomike": ["ekonomike", "bek", "b ekonomike"],
  Raiffeisen: ["raiffeisen", "rbko", "rbk", "raiffeisen kosovo", "rzb"],
  ProCredit: ["procredit", "pcb", "pro credit", "procredit holding"],
  TEB: ["teb", "teb sh a", "turk ekonomi bankasi"],
  BKT: ["bkt", "banka kombetare tregtare", "kombetare tregtare"],
  Ziraat: ["ziraat", "ziraat bankasi", "turkiye cumhuriyeti ziraat"],
  Credins: ["credins", "banka credins"],
  Pribank: ["pribank", "pri bank"],
};

const BY_FOLDED = new Map<string, string>();
for (const bank of KOSOVO_BANKS) {
  for (const candidate of [bank.code, bank.officialName, ...(ALIASES[bank.code] ?? [])]) {
    const key = fold(candidate);
    if (key) BY_FOLDED.set(key, bank.code);
  }
}

export interface BankNameMatch {
  /** The canonical code when recognised, otherwise the input, trimmed. */
  value: string | null;
  /** False when the name was left as written because nothing matched. */
  matched: boolean;
}

/**
 * Maps whatever a client's spreadsheet says onto one of the ten banks.
 *
 * An unrecognised name is **kept as written**, never blanked: an import that
 * silently dropped a bank would be worse than one that records an odd spelling,
 * and the employee form surfaces such values as "(e vjetër)" for correction.
 */
export function normalizeKosovoBankName(raw: string | null | undefined): BankNameMatch {
  const trimmed = typeof raw === "string" ? raw.trim() : "";
  if (!trimmed) return { value: null, matched: false };
  const hit = BY_FOLDED.get(fold(trimmed));
  return hit ? { value: hit, matched: true } : { value: trimmed, matched: false };
}
