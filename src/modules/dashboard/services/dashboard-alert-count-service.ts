import { cache } from "react";
import { prisma } from "@/lib/prisma";
import type { DashboardOperationalPayload } from "../types/dashboard-types";
import { parseDashboardFilters } from "../helpers/dashboard-time";
import { buildOperationalAlerts } from "./dashboard-alerts-service";

/**
 * How many operational alerts the bell should show.
 *
 * The badge used to be read off `loadDashboardOperationalData`, which meant the
 * whole dashboard payload — two dozen queries, six label lookups and an
 * unbounded employee scan — ran on *every* page of the app just to produce one
 * integer. This path fetches only what the alert rules actually branch on.
 *
 * It deliberately calls the same `buildOperationalAlerts` the dashboard calls,
 * rather than re-listing the conditions: a new alert rule then changes the badge
 * automatically instead of silently drifting from the page it points at. The
 * fields the builder only uses for *wording* (names, dates, per-row urgency) are
 * passed empty — they can change an alert's text or severity, never how many
 * alerts exist.
 */
export const countOperationalAlerts = cache(async (companyId: string): Promise<number> => {
  // The bell is global, so it reports on the same default period the dashboard
  // opens with — current UTC month, no department filter.
  const filters = parseDashboardFilters({});

  const today = new Date();
  const todayStart = new Date(
    Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate(), 0, 0, 0, 0),
  );
  const horizonEnd = new Date(
    Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() + 30, 23, 59, 59, 999),
  );
  const permitHorizon = new Date(today.getTime() + 60 * 24 * 60 * 60 * 1000);

  const [
    payrollRow,
    expiringContractsTotal,
    leaveRequestsPending,
    settingsRow,
    openPayrollCorrections,
    documentsMissingSample,
    expiringResidencePermits,
    expiredResidencePermits,
    expiringEmployeeDocuments,
    expiredEmployeeDocuments,
  ] = await Promise.all([
    prisma.payroll.findUnique({
      where: { companyId_year_month: { companyId, year: filters.year, month: filters.month } },
      select: { id: true, status: true },
    }),
    /**
     * Contract expiry lives on the employee (`contractEndDate`), not in the
     * `contracts` table this used to count — nothing in the app has ever
     * written a row there, so this alert was permanently zero and a fixed-term
     * contract could lapse with nothing on screen having said a word.
     */
    prisma.employee.count({
      where: {
        companyId,
        status: { not: "TERMINATED" },
        contractEndDate: { not: null, gte: todayStart, lte: horizonEnd },
      },
    }),
    prisma.leaveRequest.count({ where: { companyId, status: "PENDING" } }),
    prisma.payrollSettings.findUnique({
      where: { companyId },
      select: { minimumSalaryMonthly: true },
    }),
    prisma.payrollCorrection.count({
      where: { companyId, payroll: { status: { notIn: ["LOCKED", "ARCHIVED"] } } },
    }),
    // Two rows are enough: the rule only asks "any?", and the wording only
    // distinguishes one employee from several.
    prisma.employee.findMany({
      where: { companyId, documentsMissing: true, status: { not: "TERMINATED" } },
      select: { id: true, firstName: true, lastName: true },
      take: 2,
    }),
    prisma.employee.count({
      where: {
        companyId,
        isForeignNational: true,
        status: { not: "TERMINATED" },
        residencePermitExpiryDate: { not: null, lte: permitHorizon },
      },
    }),
    prisma.employee.count({
      where: {
        companyId,
        isForeignNational: true,
        status: { not: "TERMINATED" },
        residencePermitExpiryDate: { not: null, lt: today },
      },
    }),
    prisma.employeeDocument.count({
      where: {
        companyId,
        isArchived: false,
        expiresAt: { not: null, lte: permitHorizon },
        employee: { status: { not: "TERMINATED" } },
      },
    }),
    prisma.employeeDocument.count({
      where: {
        companyId,
        isArchived: false,
        expiresAt: { not: null, lt: today },
        employee: { status: { not: "TERMINATED" } },
      },
    }),
  ]);

  const [registerPdfCount, belowMinimumEmployees] = await Promise.all([
    payrollRow
      ? prisma.payrollGeneratedDocument.count({
          where: { payrollId: payrollRow.id, kind: "REGISTER_WITH_TOTALS" },
        })
      : Promise.resolve(0),
    settingsRow
      ? prisma.employee.count({
          where: {
            companyId,
            employmentType: "EMPLOYEE",
            exemptFromMinimumSalary: false,
            status: { not: "TERMINATED" },
            baseSalaryMonthly: { lt: settingsRow.minimumSalaryMonthly },
          },
        })
      : Promise.resolve(0),
  ]);

  const branchInputs: Pick<
    DashboardOperationalPayload,
    "filters" | "summary" | "payroll" | "contractExpiries"
  > = {
    filters,
    summary: {
      activeEmployees: 0,
      contractsExpiringWithin30Days: expiringContractsTotal,
      payrollsInDraft: 0,
      leaveRequestsPending,
      documentsGeneratedThisMonth: 0,
      employeesTerminatedThisMonth: 0,
    },
    payroll: {
      payrollId: payrollRow?.id ?? null,
      year: filters.year,
      month: filters.month,
      status: payrollRow?.status ?? null,
      employeeCount: 0,
      totals: { grossSalary: "0", netPay: "0", employerTotalCost: "0" },
      reviewedAtIso: null,
      approvedAtIso: null,
      lockedAtIso: null,
    },
    contractExpiries: [],
  };

  return buildOperationalAlerts({
    ...branchInputs,
    payrollSettingsPresent: settingsRow != null,
    belowMinimumEmployees,
    documentsMissingCount: documentsMissingSample.length,
    documentsMissingEmployees: documentsMissingSample.map((e) => ({
      id: e.id,
      fullName: `${e.firstName} ${e.lastName}`.trim(),
    })),
    openPayrollCorrections,
    expiringContractsTotal,
    expiringResidencePermits,
    expiredResidencePermits,
    expiringEmployeeDocuments,
    expiredEmployeeDocuments,
    payrollRowExists: payrollRow != null,
    registerPdfGenerated: registerPdfCount > 0,
  }).length;
});
