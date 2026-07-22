import { describe, expect, it } from "vitest";
import { buildOperationalAlerts } from "../dashboard-alerts-service";
import type { AlertBuilderInput } from "../dashboard-alerts-service";
import type { DashboardOperationalPayload } from "../../types/dashboard-types";

const basePayload: Omit<DashboardOperationalPayload, "alerts" | "recommendedActions"> = {
  filters: { year: 2026, month: 6, departmentId: null },
  summary: {
    activeEmployees: 3,
    contractsExpiringWithin30Days: 0,
    payrollsInDraft: 0,
    leaveRequestsPending: 0,
    documentsGeneratedThisMonth: 0,
    employeesTerminatedThisMonth: 0,
  },
  payroll: {
    payrollId: "pay-1",
    year: 2026,
    month: 6,
    status: "LOCKED",
    employeeCount: 3,
    totals: { grossSalary: "0", netPay: "0", employerTotalCost: "0" },
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

const alertExtras: Omit<AlertBuilderInput, keyof typeof basePayload> = {
  payrollSettingsPresent: true,
  belowMinimumEmployees: 0,
  documentsMissingEmployees: [],
  openPayrollCorrections: 0,
  expiringContractsTotal: 0,
  expiringResidencePermits: 0,
  expiredResidencePermits: 0,
  payrollRowExists: true,
  registerPdfGenerated: true,
};

describe("buildOperationalAlerts missing docs routing", () => {
  it("links to employee profile with edit=documents when one employee is flagged", () => {
    const alerts = buildOperationalAlerts({
      ...basePayload,
      ...alertExtras,
      documentsMissingEmployees: [{ id: "emp-1", fullName: "Arben Krasniqi" }],
    });

    const alert = alerts.find((a) => a.id === "documents-missing-flag");
    expect(alert?.title).toBe("Arben Krasniqi ka dokumentacion të paplotë");
    expect(alert?.href).toBe("/punonjesit/emp-1?edit=documents");
    expect(alert?.actionLabel).toBe("Rishiko punonjësin");
  });

  it("links to filtered employees list when multiple employees are flagged", () => {
    const alerts = buildOperationalAlerts({
      ...basePayload,
      ...alertExtras,
      documentsMissingEmployees: [
        { id: "emp-1", fullName: "Arben Krasniqi" },
        { id: "emp-2", fullName: "Blerta Hoxha" },
      ],
    });

    const alert = alerts.find((a) => a.id === "documents-missing-flag");
    expect(alert?.title).toBe("2 punonjës kanë dokumentacion të paplotë");
    expect(alert?.href).toBe("/punonjesit?documentsMissing=1");
    expect(alert?.actionLabel).toBe("Rishiko punonjësit");
  });
});

describe("buildOperationalAlerts residence permits (Shtetas i huaj)", () => {
  it("emits no permit alert when nothing expires", () => {
    const alerts = buildOperationalAlerts({ ...basePayload, ...alertExtras });
    expect(alerts.find((a) => a.id === "residence-permits-expiring")).toBeUndefined();
  });

  it("warns when permits expire within 60 days", () => {
    const alerts = buildOperationalAlerts({
      ...basePayload,
      ...alertExtras,
      expiringResidencePermits: 2,
      expiredResidencePermits: 0,
    });
    const alert = alerts.find((a) => a.id === "residence-permits-expiring");
    expect(alert?.severity).toBe("warning");
    expect(alert?.title).toBe("2 leje qëndrimi në skadencë (60 ditë)");
  });

  it("escalates to critical when a permit is already expired", () => {
    const alerts = buildOperationalAlerts({
      ...basePayload,
      ...alertExtras,
      expiringResidencePermits: 3,
      expiredResidencePermits: 1,
    });
    const alert = alerts.find((a) => a.id === "residence-permits-expiring");
    expect(alert?.severity).toBe("critical");
    expect(alert?.title).toBe("1 leje qëndrimi e skaduar");
    // critical sorts first
    expect(alerts[0]?.id).toBe("residence-permits-expiring");
  });
});
