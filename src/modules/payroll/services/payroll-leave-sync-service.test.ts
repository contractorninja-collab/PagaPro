import { beforeEach, describe, expect, it, vi } from "vitest";

const payrollFindMany = vi.hoisted(() => vi.fn());
const entryFindUnique = vi.hoisted(() => vi.fn());
const leaveFindMany = vi.hoisted(() => vi.fn());
const approximateLeave = vi.hoisted(() => vi.fn());
const updateEntry = vi.hoisted(() => vi.fn());
const resolveWorkingTime = vi.hoisted(() => vi.fn());

vi.mock("@/lib/prisma", () => ({
  prisma: {
    payroll: { findMany: payrollFindMany },
    payrollEntry: { findUnique: entryFindUnique },
    leaveRequest: { findMany: leaveFindMany },
  },
}));

vi.mock("@/modules/payroll/services/payroll-leave-integration-service", () => ({
  approximateLeaveHoursForPayrollMonth: approximateLeave,
}));

vi.mock("@/modules/payroll/services/payroll-period-service", () => ({
  updatePayrollEntryAmounts: updateEntry,
}));

vi.mock("@/modules/payroll/services/payroll-working-time-service", () => ({
  resolvePayrollMonthWorkingTime: resolveWorkingTime,
}));

import { syncDraftPayrollsForLeaveChange } from "@/modules/payroll/services/payroll-leave-sync-service";

const updatedAt = new Date("2026-07-16T10:00:00.000Z");

describe("syncDraftPayrollsForLeaveChange", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    payrollFindMany.mockResolvedValue([{ id: "pay-1", year: 2026, month: 7, status: "DRAFT" }]);
    entryFindUnique.mockResolvedValue({
      id: "entry-1",
      expectedRegularHours: 176,
      updatedAt,
      notes: "keep this note",
      manualGrossOverride: 1200,
      bonuses: 75,
      overtimeHours: 4,
      employee: { weeklyHours: 20 },
    });
    leaveFindMany.mockResolvedValue([{ id: "leave-1" }]);
    resolveWorkingTime.mockResolvedValue({ hoursPerWorkingDay: "8" });
    approximateLeave.mockResolvedValue({
      paidLeaveHours: 80,
      sickLeaveHours: 8,
      unpaidLeaveHours: 16,
    });
    updateEntry.mockResolvedValue({ ok: true });
  });

  it("overwrites only leave/derived regular hours in place and keeps the optimistic guard", async () => {
    const result = await syncDraftPayrollsForLeaveChange({
      companyId: "company-1",
      employeeId: "employee-1",
      startDate: new Date(Date.UTC(2026, 6, 6)),
      endDate: new Date(Date.UTC(2026, 6, 17)),
      actorUserId: "user-1",
    });

    expect(result.synced).toEqual([{ payrollId: "pay-1", year: 2026, month: 7 }]);
    expect(updateEntry).toHaveBeenCalledWith(
      "company-1",
      "entry-1",
      {
        actualRegularHours: "88.00",
        paidLeaveHours: "80.00",
        sickLeaveHours: "8.00",
        unpaidLeaveHours: "16.00",
      },
      "user-1",
      { expectedUpdatedAt: updatedAt },
    );
    const patch = updateEntry.mock.calls[0]?.[2] as Record<string, unknown>;
    expect(patch).not.toHaveProperty("notes");
    expect(patch).not.toHaveProperty("manualGrossOverride");
    expect(patch).not.toHaveProperty("bonuses");
    expect(patch).not.toHaveProperty("overtimeHours");
  });

  it("applies uncapped leave hours and floors derived regular hours at zero", async () => {
    approximateLeave.mockResolvedValue({
      paidLeaveHours: 200,
      sickLeaveHours: 0,
      unpaidLeaveHours: 0,
    });
    await syncDraftPayrollsForLeaveChange({
      companyId: "company-1",
      employeeId: "employee-1",
      startDate: new Date(Date.UTC(2026, 6, 1)),
      endDate: new Date(Date.UTC(2026, 6, 31)),
    });
    expect(updateEntry.mock.calls[0]?.[2]).toMatchObject({
      actualRegularHours: "0.00",
      paidLeaveHours: "200.00",
    });
  });

  it("restores regular hours when revocation leaves no approved hours", async () => {
    approximateLeave.mockResolvedValue({
      paidLeaveHours: 0,
      sickLeaveHours: 0,
      unpaidLeaveHours: 0,
    });
    await syncDraftPayrollsForLeaveChange({
      companyId: "company-1",
      employeeId: "employee-1",
      startDate: new Date(Date.UTC(2026, 6, 6)),
      endDate: new Date(Date.UTC(2026, 6, 17)),
    });
    expect(updateEntry.mock.calls[0]?.[2]).toMatchObject({
      actualRegularHours: "176.00",
      paidLeaveHours: "0.00",
      sickLeaveHours: "0.00",
      unpaidLeaveHours: "0.00",
    });
  });

  it("does not mutate non-DRAFT payrolls and returns a visible warning", async () => {
    payrollFindMany.mockResolvedValue([{ id: "pay-reviewed", year: 2026, month: 7, status: "REVIEWED" }]);
    entryFindUnique.mockResolvedValue({ id: "entry-reviewed" });
    const result = await syncDraftPayrollsForLeaveChange({
      companyId: "company-1",
      employeeId: "employee-1",
      startDate: new Date(Date.UTC(2026, 6, 6)),
      endDate: new Date(Date.UTC(2026, 6, 17)),
    });
    expect(updateEntry).not.toHaveBeenCalled();
    expect(result.skipped).toHaveLength(1);
    expect(result.skipped[0]?.reason).toContain("REVIEWED");
  });
});
