import { describe, expect, it } from "vitest";
import { applyBreakDeduction, roundIntervals } from "./interval-policies";
import type { WorkedInterval } from "./types";

function iv(startIso: string, endIso: string): WorkedInterval {
  return { start: new Date(startIso), end: new Date(endIso) };
}

const MIN = 60_000;
const minutes = (list: WorkedInterval[]) =>
  list.reduce((s, i) => s + (i.end.getTime() - i.start.getTime()) / MIN, 0);

describe("roundIntervals", () => {
  it("rounds both boundaries to the nearest grid mark", () => {
    // 07:56 → 08:00 (worker loses 4), 16:04 → 16:00 (worker loses 4)…
    const [a] = roundIntervals([iv("2026-08-10T05:56:00Z", "2026-08-10T14:04:00Z")], 15);
    expect(a!.start.toISOString()).toBe("2026-08-10T06:00:00.000Z");
    expect(a!.end.toISOString()).toBe("2026-08-10T14:00:00.000Z");

    // …and 08:07 → 08:00 (worker GAINS 7): nearest is symmetric, not a clip.
    const [b] = roundIntervals([iv("2026-08-10T06:07:00Z", "2026-08-10T14:08:00Z")], 15);
    expect(b!.start.toISOString()).toBe("2026-08-10T06:00:00.000Z");
    expect(b!.end.toISOString()).toBe("2026-08-10T14:15:00.000Z");
  });

  it("is off at 0 and leaves intervals untouched", () => {
    const src = [iv("2026-08-10T05:56:00Z", "2026-08-10T14:04:00Z")];
    expect(roundIntervals(src, 0)).toEqual(src);
  });

  it("drops an interval that rounding collapses", () => {
    // Both boundaries land on the same grid mark — a badge fumble, not a shift.
    const out = roundIntervals([iv("2026-08-10T06:02:00Z", "2026-08-10T06:06:00Z")], 15);
    expect(out).toHaveLength(0);
  });
});

describe("applyBreakDeduction", () => {
  it("cuts the deduction out of the middle of a long single interval", () => {
    // 08:00–17:00 local (9h), 60-minute unpaid lunch policy after 6h.
    const out = applyBreakDeduction([iv("2026-08-10T06:00:00Z", "2026-08-10T15:00:00Z")], 60, 360);

    expect(out).toHaveLength(2);
    expect(minutes(out)).toBe(480);
    // The gap sits midday, so evening minutes (night windows) are untouched.
    expect(out[0]!.end.toISOString()).toBe("2026-08-10T10:00:00.000Z");
    expect(out[1]!.start.toISOString()).toBe("2026-08-10T11:00:00.000Z");
  });

  it("never deducts from someone who badged their own break", () => {
    // Two intervals = they clocked out for lunch and are already unpaid for it.
    const src = [
      iv("2026-08-10T06:00:00Z", "2026-08-10T10:00:00Z"),
      iv("2026-08-10T10:45:00Z", "2026-08-10T15:00:00Z"),
    ];
    expect(applyBreakDeduction(src, 60, 360)).toEqual(src);
  });

  it("leaves short days alone", () => {
    // 5h30 — under the 6h threshold, there was no lunch in it.
    const src = [iv("2026-08-10T06:00:00Z", "2026-08-10T11:30:00Z")];
    expect(applyBreakDeduction(src, 60, 360)).toEqual(src);
  });

  it("is off at 0", () => {
    const src = [iv("2026-08-10T06:00:00Z", "2026-08-10T15:00:00Z")];
    expect(applyBreakDeduction(src, 0, 360)).toEqual(src);
  });

  it("refuses to consume the whole interval", () => {
    const src = [iv("2026-08-10T06:00:00Z", "2026-08-10T06:50:00Z")];
    expect(applyBreakDeduction(src, 60, 30)).toEqual(src);
  });
});
