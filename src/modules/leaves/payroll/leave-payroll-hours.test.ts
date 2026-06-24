import { describe, expect, it, vi } from "vitest";

vi.mock("@/modules/leaves/services/leave-working-time-service", () => ({
  getMergedHolidayIsoSetForUtcRange: vi.fn(async () => new Set<string>()),
}));

import { approximateLeaveHoursForPayrollMonth } from "@/modules/leaves/payroll/leave-payroll-hours";

describe("leave-payroll-hours parity & Art 34.2", () => {
  it("matches naive paid+sick split without interruption link", async () => {
    const monthStart = new Date(Date.UTC(2025, 0, 1, 0, 0, 0, 0));
    const monthEnd = new Date(Date.UTC(2025, 0, 31, 23, 59, 59, 999));
    const r = await approximateLeaveHoursForPayrollMonth({
      companyId: "c1",
      monthStart,
      monthEnd,
      dailyHours: 8,
      requests: [
        {
          id: "a",
          type: "PUSHIM_VJETOR",
          subtype: "NONE",
          startDate: new Date(Date.UTC(2025, 0, 6, 12, 0, 0, 0)),
          endDate: new Date(Date.UTC(2025, 0, 7, 12, 0, 0, 0)),
          isPaid: true,
          affectsPayroll: true,
          interruptedByLeaveRequestId: null,
        },
      ],
    });
    expect(r.paidLeaveHours).toBe(16);
    expect(r.sickLeaveHours).toBe(0);
  });

  it("removes overlapping annual paid hours when sick interruption is linked", async () => {
    const monthStart = new Date(Date.UTC(2025, 0, 1, 0, 0, 0, 0));
    const monthEnd = new Date(Date.UTC(2025, 0, 31, 23, 59, 59, 999));
    const annualId = "annual1";
    const sickId = "sick1";
    const out = await approximateLeaveHoursForPayrollMonth({
      companyId: "c1",
      monthStart,
      monthEnd,
      dailyHours: 8,
      requests: [
        {
          id: annualId,
          type: "PUSHIM_VJETOR",
          subtype: "NONE",
          startDate: new Date(Date.UTC(2025, 0, 6, 12, 0, 0, 0)),
          endDate: new Date(Date.UTC(2025, 0, 10, 12, 0, 0, 0)),
          isPaid: true,
          affectsPayroll: true,
          interruptedByLeaveRequestId: sickId,
        },
        {
          id: sickId,
          type: "PUSHIM_MJEKESOR",
          subtype: "NONE",
          startDate: new Date(Date.UTC(2025, 0, 8, 12, 0, 0, 0)),
          endDate: new Date(Date.UTC(2025, 0, 10, 12, 0, 0, 0)),
          isPaid: true,
          affectsPayroll: true,
          interruptedByLeaveRequestId: null,
        },
      ],
    });
    expect(out.paidLeaveHours).toBe(16);
    expect(out.sickLeaveHours).toBe(24);
  });
});
