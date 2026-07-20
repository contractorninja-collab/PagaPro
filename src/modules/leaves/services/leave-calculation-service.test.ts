import { beforeEach, describe, expect, it, vi } from "vitest";

const getHours = vi.hoisted(() => vi.fn(async () => 6));
const getHolidays = vi.hoisted(() => vi.fn(async () => new Set(["2025-01-08"])));

vi.mock("@/modules/leaves/services/leave-working-time-service", () => ({
  getHoursPerWorkingDayForCompany: getHours,
  getMergedHolidayIsoSetForUtcRange: getHolidays,
}));

import {
  LEAVE_ENGINE_RULE_VERSION_V1,
  LEAVE_ENGINE_RULE_VERSION_V2,
} from "@/modules/leaves/constants/rule-versions";
import { computeLeaveMetrics } from "@/modules/leaves/services/leave-calculation-service";

describe("computeLeaveMetrics rule versions", () => {
  beforeEach(() => {
    getHours.mockClear();
    getHolidays.mockClear();
  });

  it("keeps v1 company hours and excludes weekday holidays", async () => {
    const result = await computeLeaveMetrics(
      "c1",
      new Date(Date.UTC(2025, 0, 6, 12)),
      new Date(Date.UTC(2025, 0, 10, 12)),
      LEAVE_ENGINE_RULE_VERSION_V1,
    );
    expect(result.workingDays).toBe(4);
    expect(result.totalHours).toBe("24.00");
    expect(result.hoursPerDay).toBe("6");
  });

  it("uses fixed 8-hour weekdays and includes holidays for v2", async () => {
    const result = await computeLeaveMetrics(
      "c1",
      new Date(Date.UTC(2025, 0, 6, 12)),
      new Date(Date.UTC(2025, 0, 10, 12)),
      LEAVE_ENGINE_RULE_VERSION_V2,
    );
    expect(result.workingDays).toBe(5);
    expect(result.totalHours).toBe("40.00");
    expect(result.hoursPerDay).toBe("8");
    expect(result.weekdayHolidayDatesInRange).toEqual(["2025-01-08"]);
    expect(getHours).not.toHaveBeenCalled();
  });
});
