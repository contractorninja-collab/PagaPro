import { describe, expect, it } from "vitest";
import {
  inferDirection,
  isDuplicateScan,
  pairedMinutes,
  SHIFT_LOOKBACK_MS,
} from "./punch-inference";
import type { PunchLike } from "./punch-inference";

const at = (iso: string, direction: "IN" | "OUT"): PunchLike => ({
  occurredAt: new Date(iso),
  direction,
});

/** Punches the kiosk would still see, given the rolling lookback. */
function withinLookback(punches: PunchLike[], now: Date): PunchLike[] {
  const floor = now.getTime() - SHIFT_LOOKBACK_MS;
  return punches.filter((p) => p.occurredAt.getTime() >= floor);
}

describe("inferDirection", () => {
  it("treats the first scan of a shift as an entry", () => {
    expect(inferDirection([])).toBe("IN");
  });

  it("alternates after an entry", () => {
    expect(inferDirection([at("2026-07-28T07:00:00Z", "IN")])).toBe("OUT");
  });

  it("starts a new pair after an exit", () => {
    expect(
      inferDirection([at("2026-07-28T07:00:00Z", "IN"), at("2026-07-28T11:00:00Z", "OUT")]),
    ).toBe("IN");
  });

  it("reads a night shift's post-midnight scan as the exit, not a second entry", () => {
    // Clocked in 21:00, scanning out at 05:00 the next calendar day.
    const clockIn = at("2026-07-27T19:00:00Z", "IN"); // 21:00 local
    const now = new Date("2026-07-28T03:00:00Z"); // 05:00 local

    expect(inferDirection(withinLookback([clockIn], now))).toBe("OUT");
  });

  it("reads as an entry again when the previous clock-out was forgotten a day ago", () => {
    // Stale unmatched IN falls outside the window — the classifier flags that
    // day NEEDS_REVIEW rather than this scan inventing a 30-hour shift.
    const stale = at("2026-07-26T06:00:00Z", "IN");
    const now = new Date("2026-07-28T06:00:00Z");

    expect(inferDirection(withinLookback([stale], now))).toBe("IN");
  });
});

describe("isDuplicateScan", () => {
  it("ignores a re-trigger within a minute", () => {
    const now = new Date("2026-07-28T07:00:20Z");
    expect(isDuplicateScan([at("2026-07-28T07:00:00Z", "IN")], now)).toBe(true);
  });

  it("accepts a genuine second scan after the guard window", () => {
    const now = new Date("2026-07-28T07:02:00Z");
    expect(isDuplicateScan([at("2026-07-28T07:00:00Z", "IN")], now)).toBe(false);
  });

  it("never treats the first scan as a duplicate", () => {
    expect(isDuplicateScan([], new Date("2026-07-28T07:00:00Z"))).toBe(false);
  });
});

describe("pairedMinutes", () => {
  it("sums a plain 09:00–17:00 day", () => {
    expect(
      pairedMinutes([at("2026-07-28T07:00:00Z", "IN"), at("2026-07-28T15:00:00Z", "OUT")]),
    ).toBe(480);
  });

  it("excludes an open shift — a clock-in alone is worth nothing yet", () => {
    expect(pairedMinutes([at("2026-07-28T07:00:00Z", "IN")])).toBe(0);
  });

  it("adds a lunch-split day back together", () => {
    expect(
      pairedMinutes([
        at("2026-07-28T07:00:00Z", "IN"),
        at("2026-07-28T11:00:00Z", "OUT"),
        at("2026-07-28T11:30:00Z", "IN"),
        at("2026-07-28T15:00:00Z", "OUT"),
      ]),
    ).toBe(450); // 240 + 210 — the 30-minute break is not paid time
  });

  it("counts an overnight shift as one span", () => {
    expect(
      pairedMinutes([at("2026-07-27T19:00:00Z", "IN"), at("2026-07-28T03:00:00Z", "OUT")]),
    ).toBe(480);
  });

  it("ignores a stray exit with no matching entry", () => {
    expect(pairedMinutes([at("2026-07-28T15:00:00Z", "OUT")])).toBe(0);
  });
});
