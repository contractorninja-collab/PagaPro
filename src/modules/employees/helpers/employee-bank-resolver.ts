import { decryptField } from "@/lib/field-crypto";

/**
 * One answer to "which account does this employee get paid into".
 *
 * Three call sites used to answer it differently — the payslip preferred the
 * bank-account row, the profile preferred the legacy `Employee.bankAccountIban`
 * column, and contract placeholders read the row and never fell back at all.
 * For an employee whose two records disagree, the payslip, the profile and the
 * signed contract each printed a different account number. The payment list
 * must not become a fourth answer, so the rule lives here once.
 *
 * Pure: no Prisma types, no IO, no clock of its own.
 */

export interface BankAccountRecord {
  iban: string | null;
  bankName?: string | null;
  accountHolderName?: string | null;
  bicSwift?: string | null;
  isPrimary?: boolean | null;
  validFrom?: Date | null;
  validTo?: Date | null;
}

export interface EmployeeBankSubject {
  firstName: string;
  lastName: string;
  bankName?: string | null;
  /** Legacy convenience column, kept in step with the primary account row. */
  bankAccountIban?: string | null;
  bankAccounts?: BankAccountRecord[] | null;
}

/**
 * Where the number came from. The payslip ignores this; the payment list uses
 * it to tell "paid from the primary active account" apart from "paid from a
 * fallback nobody has confirmed lately", which is a warning worth printing.
 */
export type BankAccountSource =
  | "PRIMARY_ACTIVE"
  | "FALLBACK_ACCOUNT"
  | "LEGACY_EMPLOYEE_FIELD"
  | "NONE";

export interface ResolvedEmployeeBank {
  bankName: string | null;
  /** Decrypted. `null` when absent; the literal `"***"` when undecryptable. */
  iban: string | null;
  accountHolder: string;
  bicSwift: string | null;
  source: BankAccountSource;
}

/** Blank and whitespace-only are absent — an empty account number was never payable. */
function present(value: string | null | undefined): string | null {
  if (value == null) return null;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

/**
 * Ordered the way the caller's `orderBy` would have, but done here: callers pass
 * anything from a full unsorted list to a single `take: 1` row, and a resolver
 * whose answer depends on the shape of someone else's query is a trap.
 */
function sortAccounts(accounts: BankAccountRecord[]): BankAccountRecord[] {
  return [...accounts].sort((a, b) => {
    const primary = Number(Boolean(b.isPrimary)) - Number(Boolean(a.isPrimary));
    if (primary !== 0) return primary;
    return (b.validFrom?.getTime() ?? 0) - (a.validFrom?.getTime() ?? 0);
  });
}

export function resolveEmployeeBank(
  employee: EmployeeBankSubject,
  now: Date = new Date(),
): ResolvedEmployeeBank {
  const accounts = sortAccounts(employee.bankAccounts ?? []).filter(
    (a) => present(a.iban) != null,
  );

  const active =
    accounts.find(
      (a) => Boolean(a.isPrimary) && (a.validTo == null || a.validTo > now),
    ) ?? null;
  const chosen = active ?? accounts[0] ?? null;

  const legacy = present(employee.bankAccountIban);
  const storedIban = chosen ? present(chosen.iban) : legacy;

  let source: BankAccountSource = "NONE";
  if (chosen) source = active ? "PRIMARY_ACTIVE" : "FALLBACK_ACCOUNT";
  else if (legacy) source = "LEGACY_EMPLOYEE_FIELD";

  return {
    bankName: present(chosen?.bankName) ?? present(employee.bankName),
    // Stored encrypted; payslips and the payment list print the real number.
    iban: storedIban ? decryptField(storedIban) : null,
    accountHolder:
      present(chosen?.accountHolderName) ??
      `${employee.firstName} ${employee.lastName}`.trim(),
    bicSwift: present(chosen?.bicSwift),
    source,
  };
}
