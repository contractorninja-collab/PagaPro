import { describe, expect, it } from "vitest";
import {
  assignLanes,
  buildWallchartDays,
  clampBar,
  countCoverage,
  monthSlice,
  peakCoverage,
} from "@/modules/leaves/wallchart/wallchart-layout";

describe("buildWallchartDays", () => {
  it("starts the Monday on or before the 1st and spans six weeks", () => {
    // August 2026 begins on a Saturday; the Monday before is July 27.
    const days = buildWallchartDays(2026, 8);
    expect(days).toHaveLength(42);
    expect(days[0]).toMatchObject({ iso: "2026-07-27", weekday: 0, inMonth: false });
    expect(days[5]!.iso).toBe("2026-08-01");
    expect(days[5]!.isWeekend).toBe(true);
    expect(days[41]!.iso).toBe("2026-09-06");
  });

  it("uses no lead-in when the month already starts on Monday", () => {
    // June 2026 starts on a Monday.
    const days = buildWallchartDays(2026, 6);
    expect(days[0]).toMatchObject({ iso: "2026-06-01", inMonth: true, weekday: 0 });
  });

  it("marks Saturdays and Sundays as weekend across a year boundary", () => {
    const days = buildWallchartDays(2027, 1);
    // January 2027 starts on a Friday; grid starts Monday Dec 28.
    expect(days[0]!.iso).toBe("2026-12-28");
    for (const d of days) {
      expect(d.isWeekend).toBe(d.weekday === 5 || d.weekday === 6);
    }
  });
});

describe("monthSlice", () => {
  it("addresses exactly the in-month days", () => {
    const days = buildWallchartDays(2026, 8);
    const { offset, length } = monthSlice(days);
    expect(days[offset]!.iso).toBe("2026-08-01");
    expect(length).toBe(31);
    expect(days[offset + length - 1]!.iso).toBe("2026-08-31");
  });
});

describe("clampBar", () => {
  const days = buildWallchartDays(2026, 8); // 2026-07-27 … 2026-09-06

  it("places a fully-visible bar at its exact columns", () => {
    expect(clampBar({ startIso: "2026-08-03", endIso: "2026-08-07" }, days)).toEqual({
      col: 7,
      span: 5,
    });
  });

  it("clips a bar that starts before the window", () => {
    expect(clampBar({ startIso: "2026-07-20", endIso: "2026-07-28" }, days)).toEqual({
      col: 0,
      span: 2,
    });
  });

  it("clips a bar that runs past the window", () => {
    const r = clampBar({ startIso: "2026-09-04", endIso: "2026-09-20" }, days);
    expect(r).toEqual({ col: 39, span: 3 });
  });

  it("drops a bar entirely outside the window", () => {
    expect(clampBar({ startIso: "2026-10-01", endIso: "2026-10-05" }, days)).toBeNull();
    expect(clampBar({ startIso: "2026-07-01", endIso: "2026-07-26" }, days)).toBeNull();
  });
});

describe("assignLanes", () => {
  it("keeps non-overlapping bars in lane 0", () => {
    const lanes = assignLanes([
      { startIso: "2026-08-03", endIso: "2026-08-07" },
      { startIso: "2026-08-10", endIso: "2026-08-14" },
    ]);
    expect(lanes.map((l) => l.lane)).toEqual([0, 0]);
  });

  it("splits an Art 34.2 interruption into its own lane", () => {
    // Medical leave inside an annual one — the real overlap case.
    const lanes = assignLanes([
      { startIso: "2026-08-03", endIso: "2026-08-14" },
      { startIso: "2026-08-06", endIso: "2026-08-10" },
    ]);
    expect(lanes[0]!.lane).toBe(0);
    expect(lanes[1]!.lane).toBe(1);
  });

  it("reuses a lane once its occupant has ended", () => {
    const lanes = assignLanes([
      { startIso: "2026-08-03", endIso: "2026-08-05" },
      { startIso: "2026-08-04", endIso: "2026-08-12" },
      { startIso: "2026-08-06", endIso: "2026-08-08" },
    ]);
    expect(lanes.map((l) => l.lane)).toEqual([0, 1, 0]);
  });
});

describe("countCoverage", () => {
  const days = buildWallchartDays(2026, 8);
  const holidays = new Set(["2026-08-28"]);

  it("counts distinct employees on working days and nobody on weekends or holidays", () => {
    const counts = countCoverage(
      days,
      [
        // Two absences for the same person must count once.
        { id: "a", employeeId: "e1", startIso: "2026-08-03", endIso: "2026-08-07" },
        { id: "b", employeeId: "e1", startIso: "2026-08-05", endIso: "2026-08-06" },
        { id: "c", employeeId: "e2", startIso: "2026-08-05", endIso: "2026-08-10" },
        { id: "d", employeeId: "e3", startIso: "2026-08-28", endIso: "2026-08-28" },
      ],
      holidays,
    );
    const at = (isoDay: string) => counts[days.findIndex((d) => d.iso === isoDay)];
    expect(at("2026-08-03")).toBe(1);
    expect(at("2026-08-05")).toBe(2);
    expect(at("2026-08-08")).toBe(0); // Saturday
    expect(at("2026-08-10")).toBe(1);
    expect(at("2026-08-28")).toBe(0); // holiday — counts nobody
  });
});

describe("peakCoverage", () => {
  const days = buildWallchartDays(2026, 8);

  it("finds the busiest day and prefers the earliest on ties", () => {
    const counts = countCoverage(
      days,
      [
        { id: "a", employeeId: "e1", startIso: "2026-08-05", endIso: "2026-08-06" },
        { id: "b", employeeId: "e2", startIso: "2026-08-05", endIso: "2026-08-05" },
        { id: "c", employeeId: "e3", startIso: "2026-08-12", endIso: "2026-08-13" },
        { id: "d", employeeId: "e4", startIso: "2026-08-12", endIso: "2026-08-12" },
      ],
      new Set(),
    );
    expect(peakCoverage(days, counts)).toEqual({ iso: "2026-08-05", count: 2 });
  });

  it("returns null when nobody is out", () => {
    expect(peakCoverage(days, countCoverage(days, [], new Set()))).toBeNull();
  });
});
