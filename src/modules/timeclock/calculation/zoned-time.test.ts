import { describe, expect, it } from "vitest";
import { zonedParts, zonedWallTimeToUtc } from "./zoned-time";

const TZ = "Europe/Belgrade";

describe("zonedWallTimeToUtc", () => {
  it("converts a summer wall time (UTC+2)", () => {
    const instant = zonedWallTimeToUtc("2026-08-22", 8, 0, TZ);
    expect(instant.toISOString()).toBe("2026-08-22T06:00:00.000Z");
  });

  it("converts a winter wall time (UTC+1)", () => {
    const instant = zonedWallTimeToUtc("2026-01-15", 8, 0, TZ);
    expect(instant.toISOString()).toBe("2026-01-15T07:00:00.000Z");
  });

  it("round-trips through zonedParts", () => {
    // The property the resolve dialog depends on: what HR typed is what the
    // classifier will read back for that instant.
    const instant = zonedWallTimeToUtc("2026-10-30", 22, 15, TZ);
    const parts = zonedParts(instant, TZ);
    expect(parts.isoDate).toBe("2026-10-30");
    expect(parts.hour).toBe(22);
    expect(parts.minute).toBe(15);
  });

  it("stays on the intended local day near midnight", () => {
    const instant = zonedWallTimeToUtc("2026-08-22", 0, 5, TZ);
    expect(zonedParts(instant, TZ).isoDate).toBe("2026-08-22");
    // 00:05 local summer = 22:05 UTC the previous day — the classic off-by-a-day.
    expect(instant.toISOString()).toBe("2026-08-21T22:05:00.000Z");
  });

  it("resolves a DST-transition evening sanely", () => {
    // Clocks go back 03:00→02:00 on 2026-10-25 in this zone. 02:30 happens
    // twice; either instant is acceptable, but the local reading must be 02:30.
    const instant = zonedWallTimeToUtc("2026-10-25", 2, 30, TZ);
    const parts = zonedParts(instant, TZ);
    expect(parts.isoDate).toBe("2026-10-25");
    expect(parts.hour).toBe(2);
    expect(parts.minute).toBe(30);
  });
});
