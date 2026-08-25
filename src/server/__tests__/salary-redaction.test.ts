import { describe, expect, it } from "vitest";
import {
  PAYROLL_ENTRY_MONEY_KEYS,
  canSeeEmployeeSalary,
  canSeeSalaryAggregates,
  redactEmployeeDetail,
  redactEmployeeListRow,
  redactPayrollDetail,
  redactPayrollListRow,
} from "@/server/salary-redaction";

/**
 * A fixture entry carrying EVERY key the real DTO carries. The exhaustive-key
 * test below fails the moment someone adds a field to the payroll entry DTO
 * without classifying it here as MASKED or KEPT — that is the whole point:
 * a new money field must not slip through unmasked because nobody thought
 * about it.
 */
const ENTRY_KEPT_KEYS = [
  "id",
  "employeeId",
  "employeeName",
  "jobTitle",
  "personalId",
  "employmentType",
  "salaryConfidential",
  "salaryPending",
  "isLocked",
  "expectedWorkingDays",
  "expectedRegularHours",
  "actualRegularHours",
  "paidLeaveHours",
  "sickLeaveHours",
  "unpaidLeaveHours",
  "overtimeHours",
  "weekendHours",
  "holidayHours",
  "nightHours",
  "notes",
  "paidDays",
  "timeClockOwned",
] as const;

const ENTRY_STRUCTURAL_KEYS = ["breakdown", "adjustments"] as const;

function entry(over: Record<string, unknown> = {}) {
  const base: Record<string, unknown> = {
    id: "e1",
    employeeId: "emp1",
    employeeName: "Arben Gashi",
    jobTitle: "Teknik",
    personalId: "1000000001",
    employmentType: "EMPLOYEE",
    salaryConfidential: false,
    salaryPending: false,
    isLocked: false,
    expectedWorkingDays: 22,
    expectedRegularHours: "176.00",
    actualRegularHours: "176.00",
    paidLeaveHours: "0.00",
    sickLeaveHours: "0.00",
    unpaidLeaveHours: "0.00",
    overtimeHours: "4.00",
    weekendHours: "0.00",
    holidayHours: "0.00",
    nightHours: "0.00",
    notes: null,
    paidDays: "22.00",
    timeClockOwned: false,
    breakdown: { gross: "900.00", steps: ["…"] },
    adjustments: [{ id: "a1", kind: "BONUS", label: "Shpërblim", amount: "50.00" }],
  };
  for (const k of PAYROLL_ENTRY_MONEY_KEYS) base[k] = "900.00";
  return { ...base, ...over } as never;
}

function detail(entries: ReturnType<typeof entry>[], over: Record<string, unknown> = {}) {
  return {
    payroll: { id: "p1", monthLabel: "Gusht 2026" },
    entries,
    totals: {
      gross: "1800.00",
      net: "1500.00",
      employerTotalCost: "1890.00",
      taxableIncome: "1700.00",
      pitWithheld: "120.00",
      pensionEmployee: "90.00",
      pensionEmployer: "90.00",
      headcount: entries.length,
    },
    timeline: [{ id: "t1", verb: "UPDATED", summary: "U ndryshua.", payload: { grossSalary: "900.00" } }],
    auditTrail: [{ id: "a1", action: "PATCH", diff: { netPay: "750.00" } }],
    corrections: [{ id: "c1", employeeName: "Arben Gashi", amount: "25.00", reason: "bonus 25€" }],
    ...over,
  } as never;
}

describe("exhaustive key classification", () => {
  it("every key of the fixture entry is classified as money, kept, or structural", () => {
    const allKeys = Object.keys(entry());
    const classified = new Set<string>([
      ...PAYROLL_ENTRY_MONEY_KEYS,
      ...ENTRY_KEPT_KEYS,
      ...ENTRY_STRUCTURAL_KEYS,
    ]);
    for (const key of allKeys) {
      expect(classified.has(key), `unclassified DTO key: ${key}`).toBe(true);
    }
    expect(allKeys.length).toBe(classified.size);
  });
});

describe("redactPayrollDetail — NONE", () => {
  const viewer = { salaryAccess: "NONE" as const };

  it("nulls every money field, keeps every hour and identity field", () => {
    const out = redactPayrollDetail(detail([entry()]), viewer) as never as {
      entries: Array<Record<string, unknown>>;
    };
    const e = out.entries[0]!;
    for (const key of PAYROLL_ENTRY_MONEY_KEYS) {
      expect(e[key], key).toBeNull();
    }
    for (const key of ENTRY_KEPT_KEYS) {
      expect(e[key], key).toEqual((entry() as never as Record<string, unknown>)[key]);
    }
  });

  it("nulls the breakdown, adjustments, totals, history blobs and corrections", () => {
    const out = redactPayrollDetail(detail([entry()]), viewer) as never as {
      entries: Array<{ breakdown: unknown; adjustments: Array<{ amount: unknown; label: unknown }> }>;
      totals: Record<string, unknown>;
      timeline: Array<{ payload: unknown }>;
      auditTrail: Array<{ diff: unknown }>;
      corrections: Array<{ amount: unknown; reason: unknown }>;
    };
    expect(out.entries[0]!.breakdown).toBeNull();
    expect(out.entries[0]!.adjustments[0]!.amount).toBeNull();
    expect(out.entries[0]!.adjustments[0]!.label).toBe("Shpërblim");
    expect(out.totals.gross).toBeNull();
    expect(out.totals.headcount).toBe(1);
    expect(out.timeline[0]!.payload).toBeNull();
    expect(out.auditTrail[0]!.diff).toBeNull();
    expect(out.corrections[0]!.amount).toBeNull();
    expect(out.corrections[0]!.reason).toBeNull();
  });
});

describe("redactPayrollDetail — STANDARD", () => {
  const viewer = { salaryAccess: "STANDARD" as const };

  it("keeps regular rows, masks confidential ones", () => {
    const out = redactPayrollDetail(
      detail([entry(), entry({ id: "e2", salaryConfidential: true })]),
      viewer,
    ) as never as { entries: Array<Record<string, unknown>> };

    expect(out.entries[0]!.grossSalary).toBe("900.00");
    expect(out.entries[1]!.grossSalary).toBeNull();
    expect(out.entries[1]!.actualRegularHours).toBe("176.00"); // hours survive
  });

  it("masks totals and history whenever any confidential row exists — the subtraction leak", () => {
    const out = redactPayrollDetail(
      detail([entry(), entry({ id: "e2", salaryConfidential: true })]),
      viewer,
    ) as never as { totals: Record<string, unknown>; timeline: Array<{ payload: unknown }> };

    expect(out.totals.gross).toBeNull();
    expect(out.timeline[0]!.payload).toBeNull();
  });

  it("keeps totals when no row is confidential", () => {
    const out = redactPayrollDetail(detail([entry(), entry({ id: "e2" })]), viewer) as never as {
      totals: Record<string, unknown>;
      timeline: Array<{ payload: unknown }>;
    };
    expect(out.totals.gross).toBe("1800.00");
    expect(out.timeline[0]!.payload).toEqual({ grossSalary: "900.00" });
  });
});

describe("redactPayrollDetail — FULL is the identity", () => {
  it("returns the input untouched", () => {
    const input = detail([entry({ salaryConfidential: true })]);
    const out = redactPayrollDetail(input, { salaryAccess: "FULL" });
    expect(out).toBe(input);
  });
});

describe("the two visibility predicates", () => {
  it("canSeeEmployeeSalary matches the tier table", () => {
    const regular = { salaryConfidential: false };
    const executive = { salaryConfidential: true };
    expect(canSeeEmployeeSalary({ salaryAccess: "FULL" }, executive)).toBe(true);
    expect(canSeeEmployeeSalary({ salaryAccess: "STANDARD" }, regular)).toBe(true);
    expect(canSeeEmployeeSalary({ salaryAccess: "STANDARD" }, executive)).toBe(false);
    expect(canSeeEmployeeSalary({ salaryAccess: "NONE" }, regular)).toBe(false);
  });

  it("canSeeSalaryAggregates refuses STANDARD once anything is confidential", () => {
    expect(canSeeSalaryAggregates({ salaryAccess: "STANDARD" }, { anyConfidential: false })).toBe(true);
    expect(canSeeSalaryAggregates({ salaryAccess: "STANDARD" }, { anyConfidential: true })).toBe(false);
    expect(canSeeSalaryAggregates({ salaryAccess: "NONE" }, { anyConfidential: false })).toBe(false);
    expect(canSeeSalaryAggregates({ salaryAccess: "FULL" }, { anyConfidential: true })).toBe(true);
  });
});

describe("redactPayrollListRow", () => {
  const row = { id: "p1", totalGross: "1800.00" as string | null, totalNet: "1500.00" as string | null };

  it("keeps totals for FULL, masks for NONE", () => {
    expect(redactPayrollListRow(row, { salaryAccess: "FULL" }, { anyConfidential: true }).totalGross).toBe("1800.00");
    expect(redactPayrollListRow(row, { salaryAccess: "NONE" }, { anyConfidential: false }).totalGross).toBeNull();
  });

  it("STANDARD loses list totals only when the company has confidential staff", () => {
    expect(redactPayrollListRow(row, { salaryAccess: "STANDARD" }, { anyConfidential: false }).totalNet).toBe("1500.00");
    expect(redactPayrollListRow(row, { salaryAccess: "STANDARD" }, { anyConfidential: true }).totalNet).toBeNull();
  });
});

describe("employee redactors", () => {
  const listRow = { id: "e1", baseSalaryMonthly: "850.00" as string | null, salaryConfidential: false };

  it("list row: NONE loses the salary, STANDARD loses only confidential rows", () => {
    expect(redactEmployeeListRow(listRow, { salaryAccess: "NONE" }).baseSalaryMonthly).toBeNull();
    expect(redactEmployeeListRow(listRow, { salaryAccess: "STANDARD" }).baseSalaryMonthly).toBe("850.00");
    expect(
      redactEmployeeListRow({ ...listRow, salaryConfidential: true }, { salaryAccess: "STANDARD" })
        .baseSalaryMonthly,
    ).toBeNull();
  });

  it("detail: masks salary, hourly rate, and EMPTIES the raise history", () => {
    const detailDto = {
      baseSalaryMonthly: "850.00" as string | null,
      hourlyRate: "4.90" as string | null,
      salaryConfidential: false,
      salaryHistory: [{ newBaseSalary: "850.00" }],
    };
    const out = redactEmployeeDetail(detailDto, { salaryAccess: "NONE" });
    expect(out.baseSalaryMonthly).toBeNull();
    expect(out.hourlyRate).toBeNull();
    // A history row IS a pair of salaries with a date — it goes entirely.
    expect(out.salaryHistory).toEqual([]);
    // FULL is the identity.
    expect(redactEmployeeDetail(detailDto, { salaryAccess: "FULL" })).toBe(detailDto);
  });
});
