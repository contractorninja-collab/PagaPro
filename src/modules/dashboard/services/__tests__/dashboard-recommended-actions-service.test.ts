import { describe, expect, it } from "vitest";
import { buildRecommendedActions } from "../dashboard-recommended-actions-service";
import type { DashboardOperationalPayload } from "../../types/dashboard-types";

const basePayload: Omit<DashboardOperationalPayload, "alerts" | "recommendedActions"> = {
  filters: { year: 2026, month: 6, departmentId: null },
  summary: {
    activeEmployees: 3,
    contractsExpiringWithin30Days: 0,
    payrollsInDraft: 1,
    leaveRequestsPending: 0,
    documentsGeneratedThisMonth: 18,
    employeesTerminatedThisMonth: 0,
  },
  payroll: {
    payrollId: "pay-1",
    year: 2026,
    month: 6,
    status: "REVIEWED",
    employeeCount: 3,
    totals: { grossSalary: "3150", netPay: "2780.25", employerTotalCost: "3307.50" },
    grossHistory: [],
    reviewedAtIso: null,
    approvedAtIso: null,
    lockedAtIso: null,
  },
  contractExpiries: [],
  leavePending: [],
  leaveToday: { approved: 0, rejected: 0 },
  timeline: [],
  distribution: { byStatus: {}, byEmploymentType: {}, byDepartment: [] },
};

describe("buildRecommendedActions", () => {
  it("prioritises missing docs and payroll review for finance workflow", () => {
    const actions = buildRecommendedActions({
      ...basePayload,
      payrollRowExists: true,
      documentsMissingEmployees: [{ id: "emp-1", fullName: "Arben Krasniqi" }],
      registerPdfGenerated: false,
    });

    expect(actions.map((a) => a.id)).toEqual([
      "missing-docs",
      "review-payroll",
      "generate-register",
    ]);
    expect(actions[0]?.label).toContain("dokumentacionin e munguar");
    expect(actions[0]?.href).toBe("/punonjesit/emp-1?edit=documents");
    expect(actions[2]?.label).toBe("Gjenero listën e pagave për financa");
  });

  it("routes multiple missing-doc employees to filtered list", () => {
    const actions = buildRecommendedActions({
      ...basePayload,
      payrollRowExists: true,
      documentsMissingEmployees: [
        { id: "emp-1", fullName: "Arben Krasniqi" },
        { id: "emp-2", fullName: "Blerta Hoxha" },
      ],
      registerPdfGenerated: false,
    });

    expect(actions[0]?.href).toBe("/punonjesit?documentsMissing=1");
  });

  it("skips PDF generation when register already exists", () => {
    const actions = buildRecommendedActions({
      ...basePayload,
      payrollRowExists: true,
      documentsMissingEmployees: [],
      registerPdfGenerated: true,
    });

    expect(actions.some((a) => a.id === "generate-register")).toBe(false);
    expect(actions[0]?.id).toBe("review-payroll");
  });
});
