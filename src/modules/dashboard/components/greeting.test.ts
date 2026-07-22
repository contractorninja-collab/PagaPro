import { describe, expect, it } from "vitest";
import { greetingForKosovoTime } from "./dashboard-operational-page";

/** Builds a Date whose KOSOVO (Europe/Belgrade) wall-clock is hh:mm on 2026-07-21 (CEST, UTC+2). */
function kosovoTime(hh: number, mm: number): Date {
  return new Date(Date.UTC(2026, 6, 21, hh - 2, mm));
}

describe("greetingForKosovoTime boundaries", () => {
  it("00:01–10:30 is Mirëmëngjes", () => {
    expect(greetingForKosovoTime(kosovoTime(0, 1))).toBe("Mirëmëngjes");
    expect(greetingForKosovoTime(kosovoTime(7, 15))).toBe("Mirëmëngjes");
    expect(greetingForKosovoTime(kosovoTime(10, 30))).toBe("Mirëmëngjes");
  });

  it("10:31–18:00 is Përshëndetje", () => {
    expect(greetingForKosovoTime(kosovoTime(10, 31))).toBe("Përshëndetje");
    expect(greetingForKosovoTime(kosovoTime(13, 0))).toBe("Përshëndetje");
    expect(greetingForKosovoTime(kosovoTime(18, 0))).toBe("Përshëndetje");
  });

  it("18:01–24:00 is Mirëmbrëma (midnight inclusive)", () => {
    expect(greetingForKosovoTime(kosovoTime(18, 1))).toBe("Mirëmbrëma");
    expect(greetingForKosovoTime(kosovoTime(23, 59))).toBe("Mirëmbrëma");
    expect(greetingForKosovoTime(kosovoTime(24, 0))).toBe("Mirëmbrëma"); // 00:00 next day
  });

  it("uses Kosovo local time, not the server's UTC hour", () => {
    // 17:30 UTC = 19:30 in Kosovo (summer) → evening, even though UTC hour is 17.
    expect(greetingForKosovoTime(new Date(Date.UTC(2026, 6, 21, 17, 30)))).toBe("Mirëmbrëma");
  });
});
