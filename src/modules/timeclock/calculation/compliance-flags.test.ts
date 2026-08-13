import { describe, expect, it } from "vitest";
import {
  computeComplianceFlags,
  type ComplianceDayInput,
} from "@/modules/timeclock/calculation/compliance-flags";

const at = (iso: string): Date => new Date(iso);

function day(partial: Partial<ComplianceDayInput> & { workDateIso: string }): ComplianceDayInput {
  return {
    workedMinutes: 0,
    overtimeMinutes: 0,
    nightMinutes: 0,
    nightStackMinutes: 0,
    firstInAt: null,
    lastOutAt: null,
    ...partial,
  };
}

describe("computeComplianceFlags", () => {
  it("returns nothing for an ordinary 5×8h week", () => {
    // 2026-08-03 is a Monday.
    const days = [3, 4, 5, 6, 7].map((d) =>
      day({ workDateIso: `2026-08-0${d}`, workedMinutes: 480 }),
    );
    expect(computeComplianceFlags(days)).toEqual([]);
  });

  it("flags a week worked past 40 hours under Neni 23", () => {
    const days = [3, 4, 5, 6, 7].map((d) =>
      day({ workDateIso: `2026-08-0${d}`, workedMinutes: 9 * 60 }),
    );
    const flags = computeComplianceFlags(days);
    expect(flags).toHaveLength(1);
    expect(flags[0]!.article).toBe("Neni 23");
    expect(flags[0]!.severity).toBe("warn");
    expect(flags[0]!.detail).toContain("45");
  });

  it("buckets weeks by Monday, not by calendar month", () => {
    // Aug 1–2 2026 is a weekend belonging to the week of Mon Jul 27.
    const days = [
      day({ workDateIso: "2026-07-31", workedMinutes: 21 * 60 }),
      day({ workDateIso: "2026-08-01", workedMinutes: 20 * 60 }),
      // New week — small, must not flag.
      day({ workDateIso: "2026-08-03", workedMinutes: 8 * 60 }),
    ];
    const flags = computeComplianceFlags(days);
    expect(flags).toHaveLength(1);
    expect(flags[0]!.article).toBe("Neni 23");
    expect(flags[0]!.detail).toContain("27 korrik");
  });

  it("flags weekly overtime past 8 hours under Neni 30", () => {
    const days = [
      day({ workDateIso: "2026-08-03", workedMinutes: 10 * 60, overtimeMinutes: 5 * 60 }),
      day({ workDateIso: "2026-08-04", workedMinutes: 10 * 60, overtimeMinutes: 4 * 60 }),
    ];
    const flags = computeComplianceFlags(days);
    expect(flags.map((f) => f.article)).toEqual(["Neni 30"]);
    expect(flags[0]!.detail).toContain("9");
  });

  it("reports night work as information under Neni 27, counting stacked minutes", () => {
    const days = [
      day({ workDateIso: "2026-08-03", workedMinutes: 480, nightMinutes: 120 }),
      day({ workDateIso: "2026-08-04", workedMinutes: 480, nightStackMinutes: 60 }),
    ];
    const flags = computeComplianceFlags(days);
    expect(flags).toHaveLength(1);
    expect(flags[0]).toMatchObject({ article: "Neni 27", severity: "info" });
    expect(flags[0]!.detail).toContain("3 orë");
    expect(flags[0]!.detail).toContain("2 ditë");
  });

  it("flags a rest gap under 12 hours between two working days (Neni 31)", () => {
    const days = [
      day({
        workDateIso: "2026-08-03",
        workedMinutes: 480,
        firstInAt: at("2026-08-03T08:00:00.000Z"),
        lastOutAt: at("2026-08-03T22:00:00.000Z"),
      }),
      day({
        workDateIso: "2026-08-04",
        workedMinutes: 480,
        firstInAt: at("2026-08-04T06:00:00.000Z"), // 8h after the 22:00 out
        lastOutAt: at("2026-08-04T14:00:00.000Z"),
      }),
    ];
    const flags = computeComplianceFlags(days);
    expect(flags.map((f) => f.article)).toEqual(["Neni 31"]);
    expect(flags[0]!.detail).toContain("8");
  });

  it("does not invent a rest violation across a skipped day or missing timestamps", () => {
    const days = [
      day({
        workDateIso: "2026-08-03",
        workedMinutes: 480,
        firstInAt: at("2026-08-03T08:00:00.000Z"),
        lastOutAt: at("2026-08-03T16:00:00.000Z"),
      }),
      // NEEDS_REVIEW day — no lastOutAt; must not participate in gap math.
      day({
        workDateIso: "2026-08-04",
        firstInAt: at("2026-08-04T08:00:00.000Z"),
        lastOutAt: null,
      }),
      day({
        workDateIso: "2026-08-06",
        workedMinutes: 480,
        firstInAt: at("2026-08-06T08:00:00.000Z"),
        lastOutAt: at("2026-08-06T16:00:00.000Z"),
      }),
    ];
    expect(computeComplianceFlags(days)).toEqual([]);
  });

  it("honours custom caps", () => {
    const days = [day({ workDateIso: "2026-08-03", workedMinutes: 39 * 60 })];
    expect(computeComplianceFlags(days, { weeklyCapHours: 38 })).toHaveLength(1);
    expect(computeComplianceFlags(days, { weeklyCapHours: 40 })).toHaveLength(0);
  });
});
