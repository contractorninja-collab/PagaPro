import { describe, expect, it } from "vitest";
import { classifyExpiry } from "@/modules/employee-documents/services/employee-document-expiry";

const NOW = new Date("2026-08-20T12:00:00Z");
const days = (n: number) => new Date(NOW.getTime() + n * 24 * 60 * 60 * 1000);

describe("classifyExpiry", () => {
  it("null and invalid dates are ok — absence of a date is not an alarm", () => {
    expect(classifyExpiry(null, NOW)).toBe("ok");
    expect(classifyExpiry(undefined, NOW)).toBe("ok");
    expect(classifyExpiry("not-a-date", NOW)).toBe("ok");
  });

  it("boundaries around the 60-day horizon", () => {
    expect(classifyExpiry(days(-1), NOW)).toBe("expired");
    expect(classifyExpiry(days(1), NOW)).toBe("expiring");
    expect(classifyExpiry(days(59), NOW)).toBe("expiring");
    expect(classifyExpiry(days(60), NOW)).toBe("expiring");
    expect(classifyExpiry(days(61), NOW)).toBe("ok");
  });

  it("accepts ISO strings identically to Dates", () => {
    expect(classifyExpiry(days(30).toISOString(), NOW)).toBe("expiring");
    expect(classifyExpiry(days(90).toISOString(), NOW)).toBe("ok");
  });
});
