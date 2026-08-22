import { D } from "@/modules/payroll/calculation/money/decimal";
import { normalizeBankAccountNumber } from "@/modules/employees/validations/employee-schemas";
import type { BankAccountSource } from "@/modules/employees/helpers/employee-bank-resolver";

/**
 * Turns a locked payroll into the two lists a finance team actually needs: who
 * can be paid right now, and who cannot and why.
 *
 * The rule that shapes everything here: an employee is NEVER silently dropped.
 * A payment list that is quietly one row short is the worst failure this file
 * can have — somebody does not get their salary and nothing on screen said so.
 * So every employee appears, the problem rows are named and marked, and the
 * totals are built to reconcile against the period so a lost row is visible
 * arithmetic rather than an absence nobody can see.
 *
 * Pure — no Prisma, no IO. The input is deliberately neutral rather than a
 * PayrollEntry, so a contractor payment list can reuse it unchanged.
 */

export type BankRowIssue =
  | "MISSING_ACCOUNT"
  | "UNREADABLE_ACCOUNT"
  | "INVALID_ACCOUNT_FORMAT"
  | "NEGATIVE_NET"
  | "ZERO_NET";

/** `decryptField` returns this literal when a value cannot be read. */
const UNREADABLE = "***";

/** What goes in the account column when there is no number to put there. */
const ISSUE_MARKER: Record<BankRowIssue, string> = {
  MISSING_ACCOUNT: "MUNGON LLOGARIA",
  UNREADABLE_ACCOUNT: "E PALEXUESHME",
  INVALID_ACCOUNT_FORMAT: "FORMAT I PASAKTË",
  NEGATIVE_NET: "—",
  ZERO_NET: "—",
};

const ISSUE_NOTE: Record<BankRowIssue, string> = {
  MISSING_ACCOUNT: "Shtoni numrin e llogarisë te profili i punonjësit.",
  UNREADABLE_ACCOUNT: "Llogaria nuk mund të deshifrohet — njoftoni mbështetjen teknike.",
  INVALID_ACCOUNT_FORMAT: "Numri i ruajtur nuk ka 16 shifra.",
  NEGATIVE_NET: "Paga neto është negative — kontrolloni zbritjet.",
  ZERO_NET: "Pa pagesë këtë muaj.",
};

const SOURCE_NOTE: Partial<Record<BankAccountSource, string>> = {
  FALLBACK_ACCOUNT: "Llogari jo-primare ose e skaduar — verifikoni.",
  LEGACY_EMPLOYEE_FIELD: "Nga fusha e vjetër e profilit — verifikoni.",
};

export interface BankPaymentEntryInput {
  firstName: string;
  lastName: string;
  /** Exact decimal string, as stored (`Decimal.toString()`). */
  netPay: string;
  bank: {
    iban: string | null;
    source: BankAccountSource;
  };
}

export interface BankPaymentRow {
  nr: number;
  firstName: string;
  lastName: string;
  /** A real 16-digit number on payable rows, a marker word on blocked ones. */
  accountNumber: string;
  /** For the spreadsheet cell. Totals are computed in decimal, not from this. */
  netPay: number;
  note: string;
  issue: BankRowIssue | null;
}

export interface BankPaymentSheet {
  payable: BankPaymentRow[];
  blocked: BankPaymentRow[];
  /** 2dp strings — accumulated in decimal.js, never in floating point. */
  payableTotal: string;
  blockedTotal: string;
  grandTotal: string;
  headcount: number;
  /** Rows needing action. Deliberately excludes zero-net — see below. */
  blockedCount: number;
  zeroNetCount: number;
  /** Any row whose stored account could not be decrypted, zero-net included. */
  unreadableCount: number;
  /** Rows that have some stored account value at all. */
  withStoredAccountCount: number;
}

function classify(entry: BankPaymentEntryInput, net: ReturnType<typeof D>): BankRowIssue | null {
  /**
   * Pay first, account second — on purpose. An employee on unpaid leave for the
   * whole month is not being paid regardless of what their bank record says, so
   * raising "missing account" against them is a false alarm that trains people
   * to ignore the real ones.
   */
  if (net.isNegative()) return "NEGATIVE_NET";
  if (net.isZero()) return "ZERO_NET";

  const raw = entry.bank.iban?.trim() ?? "";
  if (raw === "") return "MISSING_ACCOUNT";

  /**
   * Must precede the format check. When FIELD_ENCRYPTION_KEY is missing or has
   * been rotated, EVERY row reads "***" — that is an operations incident, and
   * calling it a format error sends HR off to retype two hundred account
   * numbers instead of sending ops to fix an environment variable.
   */
  if (raw === UNREADABLE) return "UNREADABLE_ACCOUNT";

  if (normalizeBankAccountNumber(raw).value == null) return "INVALID_ACCOUNT_FORMAT";
  return null;
}

export function buildBankPaymentSheet(entries: BankPaymentEntryInput[]): BankPaymentSheet {
  const payable: BankPaymentRow[] = [];
  const blocked: BankPaymentRow[] = [];

  let payableTotal = D("0");
  let blockedTotal = D("0");
  let blockedCount = 0;
  let zeroNetCount = 0;
  let unreadableCount = 0;
  let withStoredAccountCount = 0;

  entries.forEach((entry, index) => {
    const net = D(entry.netPay);
    const issue = classify(entry, net);
    const raw = entry.bank.iban?.trim() ?? "";

    if (raw !== "") withStoredAccountCount += 1;
    if (raw === UNREADABLE) unreadableCount += 1;

    // Numbered across the whole list before it is split, so a gap in the
    // payable block is itself a visible sign that somebody was moved down.
    const nr = index + 1;
    const base = {
      nr,
      firstName: entry.firstName,
      lastName: entry.lastName,
      netPay: Number(net.toFixed(2)),
    };

    if (issue) {
      blocked.push({
        ...base,
        accountNumber: ISSUE_MARKER[issue],
        // The unusable value rides in the note, never in the account column,
        // so nobody can paste it into a bank upload by accident.
        note:
          issue === "INVALID_ACCOUNT_FORMAT"
            ? `${ISSUE_NOTE[issue]} (${raw})`
            : ISSUE_NOTE[issue],
        issue,
      });
      blockedTotal = blockedTotal.plus(net);
      if (issue === "ZERO_NET") zeroNetCount += 1;
      else blockedCount += 1;
      return;
    }

    payable.push({
      ...base,
      accountNumber: normalizeBankAccountNumber(raw).value ?? raw,
      note: SOURCE_NOTE[entry.bank.source] ?? "",
      issue: null,
    });
    payableTotal = payableTotal.plus(net);
  });

  return {
    payable,
    blocked,
    payableTotal: payableTotal.toFixed(2),
    blockedTotal: blockedTotal.toFixed(2),
    grandTotal: payableTotal.plus(blockedTotal).toFixed(2),
    headcount: entries.length,
    blockedCount,
    zeroNetCount,
    unreadableCount,
    withStoredAccountCount,
  };
}
