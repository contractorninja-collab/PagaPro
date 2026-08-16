import { describe, expect, it } from "vitest";
import type { PushimetBalanceRowDto } from "@/modules/leaves/types/pushimet";
import {
  collapseCohorts,
  compareAttention,
  evaluateBalanceAttention,
  topReason,
  type AttentionContext,
  type AttentionEntry,
} from "@/modules/leaves/helpers/leave-balance-attention";

const FIRST_YEAR = "KOSOVO_FIRST_YEAR_ENTITLEMENT_WARN";

const AUGUST: AttentionContext = {
  todayIso: "2026-08-16",
  currentYear: 2026,
  splitLeaveMinWorkingDays: 10,
  warnCarryOverExpiry: true,
  warnInsufficientBalance: true,
};
const JANUARY: AttentionContext = { ...AUGUST, todayIso: "2026-01-20" };
const OCTOBER: AttentionContext = { ...AUGUST, todayIso: "2026-10-01" };
const JUNE: AttentionContext = { ...AUGUST, todayIso: "2026-06-16" };

/** The row thirteen of eighteen employees actually carry in August. */
function row(overrides: Partial<PushimetBalanceRowDto> = {}): PushimetBalanceRowDto {
  return {
    id: "b1",
    employeeId: "e1",
    employeeName: "Arta Krasniqi",
    departmentName: "Shitje",
    leaveType: "PUSHIM_VJETOR",
    year: 2026,
    yearlyQuota: "20.00",
    accruedDays: "12.27",
    carryOverDays: "0.00",
    usedDays: "0.00",
    pendingDays: "0.00",
    remainingDays: "12.27",
    projectedYearEndDays: "20",
    carryExpiresIso: null,
    entitlementBreakdown: { base: 20, tenure: 0, special: 0 },
    warnings: [],
    warningCodes: [],
    ...overrides,
  } as PushimetBalanceRowDto;
}

const entry = (r: PushimetBalanceRowDto, ctx: AttentionContext = AUGUST): AttentionEntry => ({
  row: r,
  verdict: evaluateBalanceAttention(r, ctx),
});

describe("the calm majority", () => {
  it("leaves an ordinary mid-year row alone", () => {
    expect(evaluateBalanceAttention(row(), AUGUST).needsAttention).toBe(false);
  });

  it("flags nobody in January, when accrual is barely started", () => {
    // The regression the old rule got wrong: `available < 2` meant every
    // employee in the company rendered amber for the first eight weeks.
    const january = row({ accruedDays: "1.70", remainingDays: "1.70" });
    expect(evaluateBalanceAttention(january, JANUARY).needsAttention).toBe(false);
  });

  it("leaves a brand-new hire alone, low balance and all", () => {
    const newHire = row({
      accruedDays: "0.60",
      remainingDays: "0.60",
      projectedYearEndDays: "8.33",
      warningCodes: [FIRST_YEAR],
      warnings: ["Punonjësi ende nuk ka fituar të drejtën e plotë për shfrytëzim të pushimit vjetor."],
    });
    expect(evaluateBalanceAttention(newHire, AUGUST).needsAttention).toBe(false);
    // And still calm in October, when the surplus rule wakes up for everyone else.
    expect(evaluateBalanceAttention(newHire, OCTOBER).needsAttention).toBe(false);
  });
});

describe("conditions that must always surface", () => {
  it("flags a negative balance as destructive", () => {
    const v = evaluateBalanceAttention(row({ remainingDays: "-3.5" }), AUGUST);
    expect(v.needsAttention).toBe(true);
    expect(topReason(v)?.key).toBe("BALANCE_NEGATIVE");
    expect(topReason(v)?.tone).toBe("destructive");
  });

  it("does not mistake a rounding artefact for debt", () => {
    expect(evaluateBalanceAttention(row({ remainingDays: "-0.001" }), AUGUST).needsAttention).toBe(false);
  });

  it("flags requests that exceed the whole year's quota", () => {
    const v = evaluateBalanceAttention(
      row({ pendingDays: "24", remainingDays: "12.27", projectedYearEndDays: "20" }),
      AUGUST,
    );
    expect(topReason(v)?.key).toBe("PENDING_OVER_YEAR_END");
  });

  it("flags a first-year employee whose requests exceed the year, since that is arithmetic", () => {
    const v = evaluateBalanceAttention(
      row({ pendingDays: "12", projectedYearEndDays: "8.33", warningCodes: [FIRST_YEAR] }),
      AUGUST,
    );
    expect(topReason(v)?.key).toBe("PENDING_OVER_YEAR_END");
  });
});

describe("carry-over expiry windows", () => {
  const carrying = (expiresIso: string) =>
    row({ carryOverDays: "5", carryExpiresIso: expiresIso, remainingDays: "17.27" });

  it("is critical inside fourteen days and merely a warning beyond", () => {
    // 30 June is 14 days from 16 June — the critical boundary itself.
    expect(topReason(evaluateBalanceAttention(carrying("2026-06-30"), JUNE))?.key)
      .toBe("CARRY_EXPIRES_CRITICAL");
    // 15 days out — one day past the critical boundary.
    expect(topReason(evaluateBalanceAttention(carrying("2026-06-30"), { ...JUNE, todayIso: "2026-06-15" }))?.key)
      .toBe("CARRY_EXPIRES_SOON");
    // 45 days out is the engine's own window edge; 46 is outside it.
    expect(topReason(evaluateBalanceAttention(carrying("2026-06-30"), { ...JUNE, todayIso: "2026-05-16" }))?.key)
      .toBe("CARRY_EXPIRES_SOON");
    expect(evaluateBalanceAttention(carrying("2026-06-30"), { ...JUNE, todayIso: "2026-05-15" }).needsAttention)
      .toBe(false);
  });

  it("flags a row still counting days that expired, since the balance is overstated", () => {
    expect(topReason(evaluateBalanceAttention(carrying("2026-06-30"), AUGUST))?.key)
      .toBe("CARRY_EXPIRED_STALE");
  });

  it("stays silent when the company switched carry warnings off", () => {
    const ctx = { ...JUNE, warnCarryOverExpiry: false };
    expect(evaluateBalanceAttention(carrying("2026-06-30"), ctx).needsAttention).toBe(false);
  });
});

describe("the year-end surplus gate", () => {
  it("says nothing in August, when there is still time", () => {
    expect(evaluateBalanceAttention(row(), AUGUST).needsAttention).toBe(false);
  });

  it("speaks up in October, once the year is too short to spend them", () => {
    const v = evaluateBalanceAttention(row(), OCTOBER);
    expect(topReason(v)?.key).toBe("YEAR_END_SURPLUS");
  });

  it("stays quiet when the surplus is too small to schedule as one block", () => {
    const nearlyPlanned = row({ pendingDays: "12", projectedYearEndDays: "20" });
    expect(evaluateBalanceAttention(nearlyPlanned, OCTOBER).needsAttention).toBe(false);
  });

  it("ignores time-gated rules for a year that is not the live one", () => {
    const lastYear = row({ year: 2025 });
    expect(evaluateBalanceAttention(lastYear, OCTOBER).needsAttention).toBe(false);
  });
});

describe("purity", () => {
  it("gives the same verdict for the same inputs, and never reads a clock", () => {
    const r = row({ carryOverDays: "5", carryExpiresIso: "2026-06-30", remainingDays: "17.27" });
    expect(evaluateBalanceAttention(r, JUNE)).toEqual(evaluateBalanceAttention(r, JUNE));
    // Move only the day and the carry reason changes — proof the date is an input.
    expect(topReason(evaluateBalanceAttention(r, JUNE))?.key).toBe("CARRY_EXPIRES_CRITICAL");
    expect(topReason(evaluateBalanceAttention(r, { ...JUNE, todayIso: "2026-04-01" }))).toBeNull();
  });
});

describe("ordering", () => {
  it("puts the worst first and never reshuffles equal rows", () => {
    const entries = [
      entry(row({ employeeName: "Zana Zeqiri" })),
      entry(row({ employeeName: "Blerim Gashi", remainingDays: "-1" })),
      entry(row({ employeeName: "Arta Krasniqi", remainingDays: "-9" })),
      entry(row({ employeeName: "Drita Hoxha", pendingDays: "30", projectedYearEndDays: "20" })),
    ];
    const sorted = [...entries].sort(compareAttention).map((e) => e.row.employeeName);
    // -9 before -1 (bigger debt first), both before the over-quota request,
    // and the calm row last.
    expect(sorted).toEqual(["Arta Krasniqi", "Blerim Gashi", "Drita Hoxha", "Zana Zeqiri"]);
  });

  it("breaks ties by name so the order is stable between renders", () => {
    const a = entry(row({ employeeName: "Zana Zeqiri", remainingDays: "-2" }));
    const b = entry(row({ employeeName: "Arta Krasniqi", remainingDays: "-2" }));
    expect([a, b].sort(compareAttention).map((e) => e.row.employeeName)).toEqual([
      "Arta Krasniqi",
      "Zana Zeqiri",
    ]);
    expect([b, a].sort(compareAttention).map((e) => e.row.employeeName)).toEqual([
      "Arta Krasniqi",
      "Zana Zeqiri",
    ]);
  });
});

describe("cohort collapse", () => {
  it("turns the October wall of identical rows into one line", () => {
    // Thirteen untouched employees, exactly the shape of the real data.
    const entries = Array.from({ length: 13 }, (_, i) =>
      entry(row({ id: `b${i}`, employeeName: `Punonjësi ${i}` }), OCTOBER),
    );
    const { cohorts, rows } = collapseCohorts(entries);
    expect(rows).toHaveLength(0);
    expect(cohorts).toHaveLength(1);
    expect(cohorts[0]?.count).toBe(13);
    expect(cohorts[0]?.label).toContain("13 punonjës");
  });

  it("never collapses day-debt, however many people are in it", () => {
    const entries = Array.from({ length: 12 }, (_, i) =>
      entry(row({ id: `b${i}`, employeeName: `Punonjësi ${i}`, remainingDays: "-4" }), AUGUST),
    );
    const { cohorts, rows } = collapseCohorts(entries);
    expect(cohorts).toHaveLength(0);
    expect(rows).toHaveLength(12);
  });

  it("leaves a handful of rows as rows", () => {
    const entries = [
      entry(row({ employeeName: "A", remainingDays: "-4" })),
      entry(row({ employeeName: "B", pendingDays: "30", projectedYearEndDays: "20" })),
      entry(row({ employeeName: "C" })),
    ];
    const { cohorts, rows } = collapseCohorts(entries);
    expect(cohorts).toHaveLength(0);
    expect(rows.map((r) => r.row.employeeName)).toEqual(["A", "B"]);
  });
});
