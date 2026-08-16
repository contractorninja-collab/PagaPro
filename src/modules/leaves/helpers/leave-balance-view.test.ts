import { describe, expect, it } from "vitest";
import type { PushimetBalanceRowDto } from "@/modules/leaves/types/pushimet";
import {
  balanceStatSegments,
  daysUntilIso,
  entitlementLabel,
  fmtDays,
  toNum,
} from "@/modules/leaves/helpers/leave-balance-view";

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
    ...overrides,
  } as PushimetBalanceRowDto;
}

describe("toNum / fmtDays", () => {
  it("drops trailing zeros and survives junk", () => {
    expect(fmtDays("12.50")).toBe("12.5");
    expect(fmtDays("12.00")).toBe("12");
    expect(fmtDays(0)).toBe("0");
    expect(toNum("abc")).toBe(0);
    expect(toNum(null)).toBe(0);
    expect(toNum(undefined)).toBe(0);
  });
});

describe("daysUntilIso", () => {
  it("counts forward and backward from the supplied day, never the clock", () => {
    expect(daysUntilIso("2026-06-30", "2026-06-16")).toBe(14);
    expect(daysUntilIso("2026-06-30", "2026-08-16")).toBeLessThan(0);
    expect(daysUntilIso(null, "2026-08-16")).toBeNull();
    expect(daysUntilIso("not-a-date", "2026-08-16")).toBeNull();
  });

  it("is pure — the same inputs always give the same answer", () => {
    expect(daysUntilIso("2026-06-30", "2026-06-16")).toBe(daysUntilIso("2026-06-30", "2026-06-16"));
  });
});

describe("entitlementLabel", () => {
  it("stays bare when the quota is just the statutory base", () => {
    expect(entitlementLabel(row())).toBe("Kuota 20");
    expect(entitlementLabel(row({ entitlementBreakdown: null }))).toBe("Kuota 20");
  });

  it("explains the quota when tenure or hazard days lift it", () => {
    expect(
      entitlementLabel(row({ yearlyQuota: "22", entitlementBreakdown: { base: 20, tenure: 2, special: 0 } })),
    ).toBe("Kuota 22 (20 +2 vjetërsi)");
    expect(
      entitlementLabel(row({ yearlyQuota: "23", entitlementBreakdown: { base: 20, tenure: 2, special: 1 } })),
    ).toBe("Kuota 23 (20 +2 vjetërsi +1 kategori)");
  });
});

describe("balanceStatSegments", () => {
  it("reduces the thirteen identical rows to a single meaningful figure", () => {
    // The headline case: this is verbatim the row thirteen of eighteen
    // employees carried, which used to print
    // "Kuota 20 · Akumuluar 12.27 · Përdorur 0 · Pritje 0 · Fund viti 20".
    // Nothing has been used, nothing is booked, and the year lands exactly on
    // the quota — so the only figure that says anything is the quota.
    expect(balanceStatSegments(row())).toEqual(["Kuota 20"]);
  });

  it("never prints a zero for used, pending or carry", () => {
    const segments = balanceStatSegments(
      row({ usedDays: "0.00", pendingDays: "0.00", carryOverDays: "0.00" }),
    );
    expect(segments.join(" · ")).not.toContain("Përdorur");
    expect(segments.join(" · ")).not.toContain("Pritje");
    expect(segments.join(" · ")).not.toContain("Bartur");
  });

  it("shows each figure once it is real", () => {
    expect(balanceStatSegments(row({ usedDays: "8", remainingDays: "4.27", projectedYearEndDays: "12" }))).toEqual([
      "Kuota 20",
      "Përdorur 8",
      "Fund viti 12",
    ]);
    expect(balanceStatSegments(row({ pendingDays: "3", remainingDays: "9.27" }))).toContain("Pritje 3");
    expect(balanceStatSegments(row({ carryOverDays: "4", remainingDays: "16.27" }))).toContain("Bartur 4");
  });

  it("omits the projection when it merely repeats the remaining figure", () => {
    expect(
      balanceStatSegments(row({ yearlyQuota: "18", remainingDays: "20", projectedYearEndDays: "20" })),
    ).toEqual(["Kuota 18"]);
  });

  it("shows the projection only when the year will not land on the quota", () => {
    // Days spent, so the year closes below the quota — worth saying.
    expect(balanceStatSegments(row({ usedDays: "6", remainingDays: "6.27", projectedYearEndDays: "14" })))
      .toContain("Fund viti 14");
    // Carry-over lifts the year above the quota — also worth saying.
    expect(
      balanceStatSegments(row({ carryOverDays: "5", remainingDays: "17.27", projectedYearEndDays: "25" })),
    ).toContain("Fund viti 25");
  });

  it("handles a non-annual row, where projection and breakdown are always null", () => {
    expect(
      balanceStatSegments(
        row({
          leaveType: "PUSHIM_PERSONAL",
          yearlyQuota: "5",
          projectedYearEndDays: null,
          entitlementBreakdown: null,
          remainingDays: "5",
        }),
      ),
    ).toEqual(["Kuota 5"]);
  });
});
