import { describe, expect, it } from "vitest";
import { resolvePunchInstant } from "./punch-instant";

const NOW = new Date("2026-08-22T14:00:00.000Z");

describe("resolvePunchInstant", () => {
  it("uses the server clock for a live scan", () => {
    const r = resolvePunchInstant(NOW, null);
    expect(r.instant).toBe(NOW);
    expect(r.usedDeviceClock).toBe(false);
  });

  it("uses the device clock for a drained offline scan", () => {
    // Scanned at 06:58, delivered at 14:00 when the wifi came back.
    const scanned = new Date("2026-08-22T06:58:00.000Z");
    const r = resolvePunchInstant(NOW, scanned);
    expect(r.instant).toBe(scanned);
    expect(r.usedDeviceClock).toBe(true);
  });

  it("tolerates small forward skew but not a clock from the future", () => {
    const slightlyAhead = new Date(NOW.getTime() + 2 * 60 * 1000);
    expect(resolvePunchInstant(NOW, slightlyAhead).usedDeviceClock).toBe(true);

    const farAhead = new Date(NOW.getTime() + 60 * 60 * 1000);
    const r = resolvePunchInstant(NOW, farAhead);
    expect(r.instant).toBe(NOW);
    expect(r.usedDeviceClock).toBe(false);
  });

  it("distrusts an implausibly old device clock", () => {
    // A tablet reset to January is a broken clock, not a January shift.
    const r = resolvePunchInstant(NOW, new Date("2026-01-05T08:00:00.000Z"));
    expect(r.instant).toBe(NOW);
    expect(r.usedDeviceClock).toBe(false);
  });

  it("survives an invalid date without throwing", () => {
    const r = resolvePunchInstant(NOW, new Date("not-a-date"));
    expect(r.instant).toBe(NOW);
  });
});
