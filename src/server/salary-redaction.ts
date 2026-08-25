import type { SalaryAccess } from "@prisma/client";

/**
 * Server-side salary masking — the guarantee behind the visibility tiers.
 *
 * Everything here is pure: DTO in, DTO out, money fields replaced with `null`
 * for viewers who may not see them. `null` and never a sentinel string, so a
 * missed consumer surfaces as an empty cell or a type error instead of "€•••"
 * flowing through number parsing and hiding the mistake.
 *
 * The client additionally HIDES the empty columns — but that is presentation.
 * If a redactor and a component ever disagree, the redactor already won,
 * because the amount never left the server.
 *
 * Masking must cover more than the obvious numeric fields. Amounts also ride
 * in: the calculation breakdown JSON (restates gross→net step by step),
 * timeline payloads and audit diffs (raw PATCH bodies from spreadsheet
 * edits), manual-override REASONS (people type "ngritje në 850€" into them),
 * correction reasons, and adjustment rows. All of those go too.
 */

export interface SalaryViewer {
  salaryAccess: SalaryAccess;
}

/** May this viewer see THIS employee's amounts? The one per-row rule. */
export function canSeeEmployeeSalary(
  viewer: SalaryViewer,
  employee: { salaryConfidential: boolean },
): boolean {
  if (viewer.salaryAccess === "FULL") return true;
  if (viewer.salaryAccess === "STANDARD") return !employee.salaryConfidential;
  return false;
}

/** May this viewer see aggregates (totals, series, whole-company exports)? */
export function canSeeSalaryAggregates(
  viewer: SalaryViewer,
  opts: { anyConfidential: boolean },
): boolean {
  if (viewer.salaryAccess === "FULL") return true;
  // A STANDARD viewer given a total could subtract the rows they see and
  // recover the confidential remainder — so aggregates survive only when
  // nothing in them is confidential.
  if (viewer.salaryAccess === "STANDARD") return !opts.anyConfidential;
  return false;
}

/* ------------------------------------------------------------------ */
/* Payroll detail                                                      */
/* ------------------------------------------------------------------ */

/** Every money-bearing key on a payroll entry. Keep in sync via the exhaustive-key test. */
export const PAYROLL_ENTRY_MONEY_KEYS = [
  "hourlyRate",
  "regularPay",
  "paidLeavePay",
  "sickLeavePay",
  "unpaidLeaveDeduction",
  "overtimeAmount",
  "holidayAmount",
  "weekendAmount",
  "nightAmount",
  "bonuses",
  "salaryAdvanceDeduction",
  "grossSalary",
  "taxableIncome",
  "pitWithheld",
  "pensionEmployee",
  "pensionEmployer",
  "otherDeductions",
  "employerTotalCost",
  "netPay",
  "manualGrossOverride",
  "manualNetOverride",
  // Free text, but people type amounts into reasons.
  "manualGrossReason",
  "manualNetReason",
] as const;

type PayrollEntryMoneyKey = (typeof PAYROLL_ENTRY_MONEY_KEYS)[number];

interface RedactablePayrollEntry extends Record<PayrollEntryMoneyKey, string | null> {
  salaryConfidential: boolean;
  breakdown: unknown;
  adjustments: Array<{ amount: string | null } & Record<string, unknown>>;
}

interface RedactablePayrollDetail {
  entries: RedactablePayrollEntry[];
  totals: {
    gross: string | null;
    net: string | null;
    employerTotalCost: string | null;
    taxableIncome: string | null;
    pitWithheld: string | null;
    pensionEmployee: string | null;
    pensionEmployer: string | null;
    headcount: number;
  };
  timeline: Array<{ payload: unknown } & Record<string, unknown>>;
  auditTrail: Array<{ diff: unknown } & Record<string, unknown>>;
  corrections: Array<{ amount: string | null; reason: string | null } & Record<string, unknown>>;
}

function redactEntry<E extends RedactablePayrollEntry>(entry: E): E {
  const masked: E = { ...entry, breakdown: null, adjustments: entry.adjustments.map((a) => ({ ...a, amount: null })) };
  for (const key of PAYROLL_ENTRY_MONEY_KEYS) {
    (masked as Record<PayrollEntryMoneyKey, string | null>)[key] = null;
  }
  return masked;
}

/**
 * Redacts a payroll detail DTO for the viewer. FULL is the identity. NONE
 * masks everything; STANDARD masks confidential rows and — when any exist —
 * the totals and history blobs, which mix everyone's amounts together.
 */
export function redactPayrollDetail<T extends RedactablePayrollDetail>(
  dto: T,
  viewer: SalaryViewer,
): T {
  if (viewer.salaryAccess === "FULL") return dto;

  const anyConfidential = dto.entries.some((e) => e.salaryConfidential);
  const aggregatesVisible = canSeeSalaryAggregates(viewer, { anyConfidential });

  const entries = dto.entries.map((e) =>
    canSeeEmployeeSalary(viewer, e) ? e : redactEntry(e),
  );

  const totals = aggregatesVisible
    ? dto.totals
    : {
        ...dto.totals,
        gross: null,
        net: null,
        employerTotalCost: null,
        taxableIncome: null,
        pitWithheld: null,
        pensionEmployee: null,
        pensionEmployer: null,
      };

  // Timeline payloads and audit diffs carry raw edit bodies for arbitrary
  // employees; corrections carry amounts. For NONE they always go; for
  // STANDARD they go whenever a confidential employee is in the period,
  // because the blobs cannot be split per row.
  const historyVisible = viewer.salaryAccess === "STANDARD" && !anyConfidential;

  return {
    ...dto,
    entries,
    totals,
    timeline: historyVisible ? dto.timeline : dto.timeline.map((t) => ({ ...t, payload: null })),
    auditTrail: historyVisible ? dto.auditTrail : dto.auditTrail.map((a) => ({ ...a, diff: null })),
    corrections: historyVisible
      ? dto.corrections
      : dto.corrections.map((c) => ({ ...c, amount: null, reason: null })),
  };
}

/* ------------------------------------------------------------------ */
/* Payroll list                                                        */
/* ------------------------------------------------------------------ */

export function redactPayrollListRow<T extends { totalGross: string | null; totalNet: string | null }>(
  row: T,
  viewer: SalaryViewer,
  opts: { anyConfidential: boolean },
): T {
  if (canSeeSalaryAggregates(viewer, opts)) return row;
  return { ...row, totalGross: null, totalNet: null };
}

/* ------------------------------------------------------------------ */
/* Public type surface                                                 */
/* ------------------------------------------------------------------ */

/**
 * The PUBLIC shape of a redacted payroll detail: money fields are
 * `string | null` even though a FULL viewer's runtime values are all strings.
 * Exporting THIS as the DTO type is what makes TypeScript walk every consumer
 * and refuse the ones that assume an amount is always present.
 */
type Nullable<T> = T | null;

export type RedactedPayrollEntry<E extends { adjustments: readonly { amount: string }[] }> = Omit<
  E,
  PayrollEntryMoneyKey | "breakdown" | "adjustments"
> & { [K in PayrollEntryMoneyKey]: Nullable<string> } & {
  breakdown: unknown;
  adjustments: Array<Omit<E["adjustments"][number], "amount"> & { amount: Nullable<string> }>;
};

export type RedactedPayrollDetail<
  T extends {
    entries: readonly { adjustments: readonly { amount: string }[] }[];
    totals: Record<string, unknown> & { headcount: number };
    timeline: readonly Record<string, unknown>[];
    auditTrail: readonly Record<string, unknown>[];
    corrections: readonly Record<string, unknown>[];
  },
> = Omit<T, "entries" | "totals" | "timeline" | "auditTrail" | "corrections"> & {
  entries: Array<RedactedPayrollEntry<T["entries"][number]>>;
  totals: { [K in keyof T["totals"]]: K extends "headcount" ? T["totals"][K] : Nullable<string> };
  timeline: Array<Omit<T["timeline"][number], "payload"> & { payload: unknown }>;
  auditTrail: Array<Omit<T["auditTrail"][number], "diff"> & { diff: unknown }>;
  corrections: Array<
    Omit<T["corrections"][number], "amount" | "reason"> & {
      amount: Nullable<string>;
      reason: Nullable<string>;
    }
  >;
};

/* ------------------------------------------------------------------ */
/* Employees                                                           */
/* ------------------------------------------------------------------ */

export function redactEmployeeListRow<
  T extends { baseSalaryMonthly: string | null; salaryConfidential: boolean },
>(row: T, viewer: SalaryViewer): T {
  if (canSeeEmployeeSalary(viewer, row)) return row;
  return { ...row, baseSalaryMonthly: null };
}

/**
 * Detail masking: base salary, hourly rate, and the entire raise history —
 * a history row IS a pair of salaries with a date attached.
 */
export function redactEmployeeDetail<
  T extends {
    baseSalaryMonthly: string | null;
    hourlyRate: string | null;
    salaryConfidential: boolean;
    salaryHistory: unknown[];
  },
>(detail: T, viewer: SalaryViewer): T {
  if (canSeeEmployeeSalary(viewer, detail)) return detail;
  return { ...detail, baseSalaryMonthly: null, hourlyRate: null, salaryHistory: [] };
}
