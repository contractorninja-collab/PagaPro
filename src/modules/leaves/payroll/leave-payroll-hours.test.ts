import { beforeEach, describe, expect, it, vi } from "vitest";

const getHolidays = vi.hoisted(() => vi.fn(async () => new Set<string>()));

vi.mock("@/modules/leaves/services/leave-working-time-service", () => ({
  getMergedHolidayIsoSetForUtcRange: getHolidays,
}));

import {
  LEAVE_ENGINE_RULE_VERSION_V1,
  LEAVE_ENGINE_RULE_VERSION_V2,
} from "@/modules/leaves/constants/rule-versions";
import { approximateLeaveHoursForPayrollMonth } from "@/modules/leaves/payroll/leave-payroll-hours";

describe("leave-payroll-hours parity & Art 34.2", () => {
  beforeEach(() => {
    getHolidays.mockReset();
    getHolidays.mockResolvedValue(new Set<string>());
  });

  it("matches v1 paid leave without an interruption", async () => {
    const out = await approximateLeaveHoursForPayrollMonth({
      companyId: "c1",
      monthStart: new Date(Date.UTC(2025, 0, 1)),
      monthEnd: new Date(Date.UTC(2025, 0, 31, 23, 59, 59, 999)),
      dailyHours: 8,
      requests: [
        {
          id: "a",
          type: "PUSHIM_VJETOR",
          subtype: "NONE",
          startDate: new Date(Date.UTC(2025, 0, 6, 12)),
          endDate: new Date(Date.UTC(2025, 0, 7, 12)),
          isPaid: true,
          affectsPayroll: true,
          interruptedByLeaveRequestId: null,
          metricsRuleVersion: LEAVE_ENGINE_RULE_VERSION_V1,
        },
      ],
    });
    expect(out).toEqual({ paidLeaveHours: 16, sickLeaveHours: 0, unpaidLeaveHours: 0 });
  });

  it("removes overlapping annual paid hours using the annual request rule", async () => {
    const sickId = "sick1";
    const out = await approximateLeaveHoursForPayrollMonth({
      companyId: "c1",
      monthStart: new Date(Date.UTC(2025, 0, 1)),
      monthEnd: new Date(Date.UTC(2025, 0, 31, 23, 59, 59, 999)),
      dailyHours: 8,
      requests: [
        {
          id: "annual1",
          type: "PUSHIM_VJETOR",
          subtype: "NONE",
          startDate: new Date(Date.UTC(2025, 0, 6, 12)),
          endDate: new Date(Date.UTC(2025, 0, 10, 12)),
          isPaid: true,
          affectsPayroll: true,
          interruptedByLeaveRequestId: sickId,
          metricsRuleVersion: LEAVE_ENGINE_RULE_VERSION_V1,
        },
        {
          id: sickId,
          type: "PUSHIM_MJEKESOR",
          subtype: "NONE",
          startDate: new Date(Date.UTC(2025, 0, 8, 12)),
          endDate: new Date(Date.UTC(2025, 0, 10, 12)),
          isPaid: true,
          affectsPayroll: true,
          interruptedByLeaveRequestId: null,
          metricsRuleVersion: LEAVE_ENGINE_RULE_VERSION_V1,
        },
      ],
    });
    expect(out.paidLeaveHours).toBe(16);
    expect(out.sickLeaveHours).toBe(24);
  });

  it("v2 counts ten weekdays as 80 hours, including a holiday and ignoring part-time hours", async () => {
    getHolidays.mockResolvedValue(new Set(["2025-01-08"]));
    const out = await approximateLeaveHoursForPayrollMonth({
      companyId: "c1",
      monthStart: new Date(Date.UTC(2025, 0, 1)),
      monthEnd: new Date(Date.UTC(2025, 0, 31, 23, 59, 59, 999)),
      dailyHours: 4,
      requests: [
        {
          id: "v2-ten-days",
          type: "PUSHIM_VJETOR",
          subtype: "NONE",
          startDate: new Date(Date.UTC(2025, 0, 6, 12)),
          endDate: new Date(Date.UTC(2025, 0, 17, 12)),
          isPaid: true,
          affectsPayroll: true,
          interruptedByLeaveRequestId: null,
          metricsRuleVersion: LEAVE_ENGINE_RULE_VERSION_V2,
        },
      ],
    });
    expect(out).toEqual({ paidLeaveHours: 80, sickLeaveHours: 0, unpaidLeaveHours: 0 });
  });

  it("keeps v1 holiday exclusion and employee-schedule hours", async () => {
    getHolidays.mockResolvedValue(new Set(["2025-01-08"]));
    const out = await approximateLeaveHoursForPayrollMonth({
      companyId: "c1",
      monthStart: new Date(Date.UTC(2025, 0, 1)),
      monthEnd: new Date(Date.UTC(2025, 0, 31, 23, 59, 59, 999)),
      dailyHours: 4,
      requests: [
        {
          id: "v1-week",
          type: "PUSHIM_VJETOR",
          subtype: "NONE",
          startDate: new Date(Date.UTC(2025, 0, 6, 12)),
          endDate: new Date(Date.UTC(2025, 0, 10, 12)),
          isPaid: true,
          affectsPayroll: true,
          interruptedByLeaveRequestId: null,
          metricsRuleVersion: LEAVE_ENGINE_RULE_VERSION_V1,
        },
      ],
    });
    expect(out.paidLeaveHours).toBe(16);
  });

  it("routes every leave type to its existing pay bucket with fixed v2 hours", async () => {
    const day = new Date(Date.UTC(2025, 0, 6, 12));
    const common = {
      startDate: day,
      endDate: day,
      affectsPayroll: true,
      interruptedByLeaveRequestId: null,
      metricsRuleVersion: LEAVE_ENGINE_RULE_VERSION_V2,
    } as const;
    const out = await approximateLeaveHoursForPayrollMonth({
      companyId: "c1",
      monthStart: new Date(Date.UTC(2025, 0, 1)),
      monthEnd: new Date(Date.UTC(2025, 0, 31, 23, 59, 59, 999)),
      dailyHours: 2,
      requests: [
        { ...common, id: "paid", type: "PUSHIM_PERSONAL", subtype: "NONE", isPaid: true },
        { ...common, id: "sick", type: "PUSHIM_MJEKESOR", subtype: "NONE", isPaid: true },
        { ...common, id: "unpaid", type: "PUSHIM_PA_PAGESE", subtype: "NONE", isPaid: false },
      ],
    });
    expect(out).toEqual({ paidLeaveHours: 8, sickLeaveHours: 8, unpaidLeaveHours: 8 });
  });

  it("splits v2 leave across months without capping hours", async () => {
    const request = {
      id: "cross-month",
      type: "PUSHIM_VJETOR" as const,
      subtype: "NONE" as const,
      startDate: new Date(Date.UTC(2025, 2, 31, 12)),
      endDate: new Date(Date.UTC(2025, 3, 4, 12)),
      isPaid: true,
      affectsPayroll: true,
      interruptedByLeaveRequestId: null,
      metricsRuleVersion: LEAVE_ENGINE_RULE_VERSION_V2,
    };
    const march = await approximateLeaveHoursForPayrollMonth({
      companyId: "c1",
      requests: [request],
      monthStart: new Date(Date.UTC(2025, 2, 1)),
      monthEnd: new Date(Date.UTC(2025, 2, 31, 23, 59, 59, 999)),
      dailyHours: 1,
    });
    const april = await approximateLeaveHoursForPayrollMonth({
      companyId: "c1",
      requests: [request],
      monthStart: new Date(Date.UTC(2025, 3, 1)),
      monthEnd: new Date(Date.UTC(2025, 3, 30, 23, 59, 59, 999)),
      dailyHours: 1,
    });
    expect(march.paidLeaveHours).toBe(8);
    expect(april.paidLeaveHours).toBe(32);
  });
});
