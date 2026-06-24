import type {
  ContractKind,
  DocumentCategory,
  DocumentGenerationArtifactKind,
  EmploymentStatus,
  EmploymentType,
  Prisma,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type {
  ContractExpiryRow,
  DashboardFilters,
  DashboardOperationalPayload,
  DashboardPayrollSlice,
  DashboardSummaryCards,
  DocumentCategoryCount,
  EmployeeDistributionSlice,
  LeavePendingRow,
  RecentDocumentRow,
  TimelineEntryDto,
} from "../types/dashboard-types";
import { daysBetweenUtc, endOfUtcDay, startOfUtcDay, utcMonthWindow } from "../helpers/dashboard-time";
import { buildOperationalAlerts } from "./dashboard-alerts-service";

function decStr(v: null | undefined | { toString(): string }): string {
  if (v == null) return "0";
  return v.toString();
}

function actorName(u: { displayName: string | null; email: string | null } | null): string | null {
  if (!u) return null;
  const n = u.displayName?.trim();
  if (n) return n;
  const e = u.email?.trim();
  return e || null;
}

function urgencyBucket(days: number): ContractExpiryRow["urgency"] {
  if (days <= 7) return "7";
  if (days <= 14) return "14";
  return "30";
}

export async function loadDashboardOperationalData(
  companyId: string,
  filters: DashboardFilters,
): Promise<DashboardOperationalPayload> {
  const { start: monthStart, end: monthEnd } = utcMonthWindow(filters.year, filters.month);
  const today = new Date();
  const todayStart = startOfUtcDay(today);
  const horizonEnd = endOfUtcDay(
    new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() + 30)),
  );

  const empBase: Prisma.EmployeeWhereInput = {
    companyId,
    ...(filters.departmentId ? { departmentId: filters.departmentId } : {}),
  };

  const leaveDeptNested: Prisma.LeaveRequestWhereInput =
    filters.departmentId != null ? { employee: { departmentId: filters.departmentId } } : {};

  const contractDeptNested: Prisma.ContractWhereInput =
    filters.departmentId != null ? { employee: { departmentId: filters.departmentId } } : {};

  const payrollEntryEmpFilter: Prisma.PayrollEntryWhereInput =
    filters.departmentId != null ? { employee: { departmentId: filters.departmentId } } : {};

  const todayBounds = { gte: startOfUtcDay(today), lte: endOfUtcDay(today) };

  const distributionWhere: Prisma.EmployeeWhereInput = {
    companyId,
    ...(filters.departmentId ? { departmentId: filters.departmentId } : {}),
  };

  const [
    activeEmployees,
    contractsExpiringWithin30Days,
    payrollsInDraft,
    leaveRequestsPending,
    documentsGeneratedThisMonth,
    employeesTerminatedThisMonth,
    payrollRow,
    payrollEntryAgg,
    expiringContracts,
    pendingLeaves,
    leaveApprovedToday,
    leaveRejectedToday,
    domainActs,
    empTimeline,
    audits,
    docTimeline,
    docCategoryGroups,
    recentArtifacts,
    statusGroups,
    employmentTypeGroups,
    deptGroups,
    departments,
    documentsMissingCount,
    correctionsOpen,
  ] = await Promise.all([
    prisma.employee.count({ where: { ...empBase, status: "ACTIVE" } }),
    prisma.contract.count({
      where: {
        companyId,
        status: "ACTIVE",
        endDate: { not: null, gte: todayStart, lte: horizonEnd },
        ...contractDeptNested,
      },
    }),
    prisma.payroll.count({ where: { companyId, status: "DRAFT" } }),
    prisma.leaveRequest.count({
      where: { companyId, status: "PENDING", ...leaveDeptNested },
    }),
    prisma.documentGenerationArtifact.count({
      where: {
        companyId,
        createdAt: { gte: monthStart, lte: monthEnd },
        kind: "ARCHIVED_FINAL",
        generationStatus: "SUCCEEDED",
      },
    }),
    prisma.employee.count({
      where: {
        ...empBase,
        status: "TERMINATED",
        terminationDate: { gte: monthStart, lte: monthEnd },
      },
    }),
    prisma.payroll.findUnique({
      where: {
        companyId_year_month: { companyId, year: filters.year, month: filters.month },
      },
      select: {
        id: true,
        status: true,
        year: true,
        month: true,
        reviewedAt: true,
        approvedAt: true,
        lockedAt: true,
      },
    }),
    prisma.payrollEntry.aggregate({
      where: {
        payroll: { companyId, year: filters.year, month: filters.month },
        ...payrollEntryEmpFilter,
      },
      _sum: { grossSalary: true, netPay: true, employerTotalCost: true },
      _count: { _all: true },
    }),
    prisma.contract.findMany({
      where: {
        companyId,
        status: "ACTIVE",
        endDate: { not: null, gte: todayStart, lte: horizonEnd },
        ...contractDeptNested,
      },
      orderBy: { endDate: "asc" },
      take: 60,
      select: {
        id: true,
        kind: true,
        endDate: true,
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            jobTitle: true,
          },
        },
      },
    }),
    prisma.leaveRequest.findMany({
      where: { companyId, status: "PENDING", ...leaveDeptNested },
      orderBy: { createdAt: "desc" },
      take: 25,
      select: {
        id: true,
        type: true,
        status: true,
        startDate: true,
        endDate: true,
        employee: { select: { id: true, firstName: true, lastName: true } },
      },
    }),
    prisma.leaveRequest.count({
      where: {
        companyId,
        status: "APPROVED",
        decidedAt: todayBounds,
        ...leaveDeptNested,
      },
    }),
    prisma.leaveRequest.count({
      where: {
        companyId,
        status: "REJECTED",
        decidedAt: todayBounds,
        ...leaveDeptNested,
      },
    }),
    prisma.domainActivity.findMany({
      where: { companyId },
      orderBy: { occurredAt: "desc" },
      take: 22,
      include: {
        actor: { select: { displayName: true, email: true } },
      },
    }),
    prisma.employeeTimelineEvent.findMany({
      where: { companyId },
      orderBy: { occurredAt: "desc" },
      take: 22,
      include: {
        actor: { select: { displayName: true, email: true } },
        employee: { select: { firstName: true, lastName: true } },
      },
    }),
    prisma.auditLog.findMany({
      where: { companyId },
      orderBy: { createdAt: "desc" },
      take: 14,
      include: {
        actor: { select: { displayName: true, email: true } },
      },
    }),
    prisma.documentTimelineEvent.findMany({
      where: { companyId },
      orderBy: { createdAt: "desc" },
      take: 12,
      include: {
        generatedDocument: { select: { title: true, documentCategory: true } },
        createdBy: { select: { displayName: true, email: true } },
        employee: { select: { firstName: true, lastName: true } },
      },
    }),
    prisma.documentGenerationArtifact.groupBy({
      by: ["documentCategory"],
      where: {
        companyId,
        createdAt: { gte: monthStart, lte: monthEnd },
        kind: "ARCHIVED_FINAL",
        generationStatus: "SUCCEEDED",
      },
      _count: { _all: true },
    }),
    prisma.documentGenerationArtifact.findMany({
      where: { companyId, generationStatus: "SUCCEEDED" },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: {
        id: true,
        title: true,
        documentCategory: true,
        kind: true,
        createdAt: true,
        employeeId: true,
        employee: { select: { firstName: true, lastName: true } },
        templateVersion: { select: { template: { select: { name: true } } } },
      },
    }),
    prisma.employee.groupBy({
      by: ["status"],
      where: distributionWhere,
      _count: { _all: true },
    }),
    prisma.employee.groupBy({
      by: ["employmentType"],
      where: distributionWhere,
      _count: { _all: true },
    }),
    prisma.employee.groupBy({
      by: ["departmentId"],
      where: distributionWhere,
      _count: { _all: true },
    }),
    prisma.department.findMany({
      where: { companyId },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.employee.count({
      where: {
        companyId,
        documentsMissing: true,
        status: { not: "TERMINATED" },
      },
    }),
    prisma.payrollCorrection.count({
      where: {
        companyId,
        payroll: { status: { notIn: ["LOCKED", "ARCHIVED"] } },
      },
    }),
  ]);

  const settingsRow = await prisma.payrollSettings.findUnique({
    where: { companyId },
    select: { minimumSalaryMonthly: true },
  });

  const belowMin =
    settingsRow != null
      ? await prisma.employee.count({
          where: {
            companyId,
            employmentType: "EMPLOYEE",
            exemptFromMinimumSalary: false,
            status: { not: "TERMINATED" },
            baseSalaryMonthly: { lt: settingsRow.minimumSalaryMonthly },
          },
        })
      : 0;

  const summary: DashboardSummaryCards = {
    activeEmployees,
    contractsExpiringWithin30Days,
    payrollsInDraft,
    leaveRequestsPending,
    documentsGeneratedThisMonth,
    employeesTerminatedThisMonth,
  };

  const payroll: DashboardPayrollSlice = {
    payrollId: payrollRow?.id ?? null,
    year: filters.year,
    month: filters.month,
    status: payrollRow?.status ?? null,
    employeeCount: payrollEntryAgg._count._all,
    totals: {
      grossSalary: decStr(payrollEntryAgg._sum.grossSalary),
      netPay: decStr(payrollEntryAgg._sum.netPay),
      employerTotalCost: decStr(payrollEntryAgg._sum.employerTotalCost),
    },
    reviewedAtIso: payrollRow?.reviewedAt?.toISOString() ?? null,
    approvedAtIso: payrollRow?.approvedAt?.toISOString() ?? null,
    lockedAtIso: payrollRow?.lockedAt?.toISOString() ?? null,
  };

  const contractExpiries: ContractExpiryRow[] = expiringContracts.map((c) => {
    const end = c.endDate!;
    const daysRemaining = Math.max(0, daysBetweenUtc(todayStart, end));
    return {
      contractId: c.id,
      employeeId: c.employee.id,
      employeeName: `${c.employee.firstName} ${c.employee.lastName}`.trim(),
      jobTitle: c.employee.jobTitle,
      contractKind: c.kind as ContractKind,
      endDateIso: end.toISOString(),
      daysRemaining,
      urgency: urgencyBucket(daysRemaining),
    };
  });

  const leavePending: LeavePendingRow[] = pendingLeaves.map((r) => ({
    id: r.id,
    employeeId: r.employee.id,
    employeeName: `${r.employee.firstName} ${r.employee.lastName}`.trim(),
    type: r.type,
    status: r.status,
    startDateIso: r.startDate.toISOString(),
    endDateIso: r.endDate.toISOString(),
  }));

  const timeline: TimelineEntryDto[] = [];

  for (const a of domainActs) {
    timeline.push({
      id: `da-${a.id}`,
      source: "domain",
      occurredAtIso: a.occurredAt.toISOString(),
      title: a.summary,
      subtitle: `${a.entityType} · ${a.verb}`,
      actorLabel: actorName(a.actor),
    });
  }

  for (const e of empTimeline) {
    timeline.push({
      id: `et-${e.id}`,
      source: "employee_timeline",
      occurredAtIso: e.occurredAt.toISOString(),
      title: e.title,
      subtitle: e.body ?? `${e.employee.firstName} ${e.employee.lastName}`,
      actorLabel: actorName(e.actor),
    });
  }

  for (const u of audits) {
    timeline.push({
      id: `al-${u.id}`,
      source: "audit",
      occurredAtIso: u.createdAt.toISOString(),
      title: `${u.action}: ${u.entityType}`,
      subtitle: u.entityId,
      actorLabel: actorName(u.actor),
    });
  }

  for (const d of docTimeline) {
    const emp =
      d.employee != null ? `${d.employee.firstName} ${d.employee.lastName}` : undefined;
    timeline.push({
      id: `dt-${d.id}`,
      source: "document_timeline",
      occurredAtIso: d.createdAt.toISOString(),
      title: d.generatedDocument.title,
      subtitle: `${d.eventType}${emp ? ` · ${emp}` : ""}`,
      actorLabel: actorName(d.createdBy),
    });
  }

  timeline.sort((x, y) => Date.parse(y.occurredAtIso) - Date.parse(x.occurredAtIso));

  const documentsThisMonthByCategory: DocumentCategoryCount[] = docCategoryGroups.map((g) => ({
    category: g.documentCategory as DocumentCategory,
    count: g._count._all,
  }));

  const recentDocuments: RecentDocumentRow[] = recentArtifacts.map((a) => ({
    id: a.id,
    title: a.title,
    category: a.documentCategory,
    kind: a.kind as DocumentGenerationArtifactKind,
    createdAtIso: a.createdAt.toISOString(),
    employeeId: a.employeeId,
    employeeName:
      a.employee != null ? `${a.employee.firstName} ${a.employee.lastName}`.trim() : null,
    templateName: a.templateVersion.template.name,
  }));

  const byStatus: Partial<Record<EmploymentStatus, number>> = {};
  for (const g of statusGroups) {
    byStatus[g.status] = g._count._all;
  }
  const byEmploymentType: Partial<Record<EmploymentType, number>> = {};
  for (const g of employmentTypeGroups) {
    byEmploymentType[g.employmentType] = g._count._all;
  }

  const deptNameById = new Map(departments.map((d) => [d.id, d.name]));
  const byDepartment: EmployeeDistributionSlice["byDepartment"] = deptGroups.map((g) => ({
    departmentId: g.departmentId,
    departmentName: g.departmentId ? (deptNameById.get(g.departmentId) ?? "Departament") : "Pa departament",
    count: g._count._all,
  }));

  const distribution: EmployeeDistributionSlice = {
    byStatus,
    byEmploymentType,
    byDepartment: byDepartment.sort((a, b) => b.count - a.count),
  };

  const payloadWithoutAlerts: Omit<DashboardOperationalPayload, "alerts"> = {
    filters,
    summary,
    payroll,
    contractExpiries,
    leavePending,
    leaveToday: { approved: leaveApprovedToday, rejected: leaveRejectedToday },
    timeline: timeline.slice(0, 42),
    documentsThisMonthByCategory,
    recentDocuments,
    distribution,
  };

  const alerts = buildOperationalAlerts({
    ...payloadWithoutAlerts,
    payrollSettingsPresent: settingsRow != null,
    belowMinimumEmployees: belowMin,
    documentsMissingEmployees: documentsMissingCount,
    openPayrollCorrections: correctionsOpen,
    expiringContractsTotal: contractsExpiringWithin30Days,
    payrollRowExists: payrollRow != null,
  });

  return { ...payloadWithoutAlerts, alerts };
}
