import type {
  ContractKind,
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
  EmployeeDistributionSlice,
  LeavePendingRow,
  TimelineEntryDto,
} from "../types/dashboard-types";
import { daysBetweenUtc, endOfUtcDay, startOfUtcDay, utcMonthWindow } from "../helpers/dashboard-time";
import { buildOperationalAlerts } from "./dashboard-alerts-service";
import {
  canonicalActivityOperation,
  collapseDashboardActivity,
  type DashboardActivityCandidate,
} from "./dashboard-activity-service";
import { buildRecommendedActions } from "./dashboard-recommended-actions-service";

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

const ENTITY_LABELS: Record<string, string> = {
  Employee: "Punonjës",
  Payroll: "Payroll",
  LeaveRequest: "Pushim",
  Termination: "Largim",
  DocumentGenerationArtifact: "Dokument",
  DocumentTemplateVersion: "Model dokumenti",
};

function entityLabel(entityType: string): string {
  return ENTITY_LABELS[entityType] ?? entityType.replace(/([a-z])([A-Z])/g, "$1 $2");
}

function auditActionLabel(action: string): string {
  const operation = canonicalActivityOperation(action);
  const labels: Record<string, string> = {
    CREATE: "U krijua",
    UPDATE: "U përditësua",
    DELETE: "U fshi",
    APPROV: "U miratua",
    REJECT: "U refuzua",
    LOCK: "U kyç",
    UNLOCK: "U çkyç",
    ARCHIV: "U arkivua",
    TERMINAT: "U përfundua",
    GENERAT: "U gjenerua",
    REGENERAT: "U rigjenerua",
    DOWNLOAD: "U shkarkua",
    CANCEL: "U anulua",
    REVOK: "U revokua",
    SUBMIT: "U dërgua",
    VOID: "U anulua",
  };
  return labels[operation] ?? action.replaceAll("_", " ").toLocaleLowerCase("sq-AL");
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
    statusGroups,
    employmentTypeGroups,
    deptGroups,
    departments,
    documentsMissingRows,
    correctionsOpen,
    payrollHistoryPeriods,
    payrollHistoryGrossGroups,
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
    prisma.employee.findMany({
      where: {
        companyId,
        documentsMissing: true,
        status: { not: "TERMINATED" },
      },
      select: { id: true, firstName: true, lastName: true },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    }),
    prisma.payrollCorrection.count({
      where: {
        companyId,
        payroll: { status: { notIn: ["LOCKED", "ARCHIVED"] } },
      },
    }),
    prisma.payroll.findMany({
      where: {
        companyId,
        OR: [
          { year: { lt: filters.year } },
          { year: filters.year, month: { lte: filters.month } },
        ],
      },
      orderBy: [{ year: "desc" }, { month: "desc" }],
      take: 6,
      select: { id: true, year: true, month: true },
    }),
    prisma.payrollEntry.groupBy({
      by: ["payrollId"],
      where: {
        payroll: {
          companyId,
          OR: [
            { year: { lt: filters.year } },
            { year: filters.year, month: { lte: filters.month } },
          ],
        },
        ...payrollEntryEmpFilter,
      },
      _sum: { grossSalary: true },
    }),
  ]);

  const activityRefs = [
    ...domainActs.map((entry) => ({ entityType: entry.entityType, entityId: entry.entityId })),
    ...audits.map((entry) => ({ entityType: entry.entityType, entityId: entry.entityId })),
    ...empTimeline
      .filter((entry) => entry.subjectKind && entry.subjectId)
      .map((entry) => ({ entityType: entry.subjectKind!, entityId: entry.subjectId! })),
  ];
  const idsFor = (entityType: string) => [
    ...new Set(
      activityRefs
        .filter((reference) => reference.entityType === entityType)
        .map((reference) => reference.entityId),
    ),
  ];

  const [
    activityEmployees,
    activityPayrolls,
    activityLeaves,
    activityTerminations,
    activityDocuments,
    activityTemplateVersions,
  ] = await Promise.all([
      prisma.employee.findMany({
        where: { companyId, id: { in: idsFor("Employee") } },
        select: { id: true, firstName: true, lastName: true },
      }),
      prisma.payroll.findMany({
        where: { companyId, id: { in: idsFor("Payroll") } },
        select: { id: true, year: true, month: true },
      }),
      prisma.leaveRequest.findMany({
        where: { companyId, id: { in: idsFor("LeaveRequest") } },
        select: {
          id: true,
          employee: { select: { firstName: true, lastName: true } },
        },
      }),
      prisma.termination.findMany({
        where: { companyId, id: { in: idsFor("Termination") } },
        select: {
          id: true,
          employee: { select: { firstName: true, lastName: true } },
        },
      }),
      prisma.documentGenerationArtifact.findMany({
        where: { companyId, id: { in: idsFor("DocumentGenerationArtifact") } },
        select: { id: true, title: true },
      }),
      prisma.documentTemplateVersion.findMany({
        where: {
          id: { in: idsFor("DocumentTemplateVersion") },
          template: { companyId },
        },
        select: { id: true, template: { select: { name: true } } },
      }),
  ]);

  const activitySubjectByKey = new Map<string, string>();
  const setSubject = (entityType: string, entityId: string, label: string) =>
    activitySubjectByKey.set(`${entityType}:${entityId}`, label);
  for (const employee of activityEmployees) {
    setSubject("Employee", employee.id, `${employee.firstName} ${employee.lastName}`.trim());
  }
  for (const period of activityPayrolls) {
    setSubject("Payroll", period.id, `Payroll ${period.month}/${period.year}`);
  }
  for (const leave of activityLeaves) {
    setSubject(
      "LeaveRequest",
      leave.id,
      `Pushimi i ${leave.employee.firstName} ${leave.employee.lastName}`.trim(),
    );
  }
  for (const termination of activityTerminations) {
    setSubject(
      "Termination",
      termination.id,
      `Largimi i ${termination.employee.firstName} ${termination.employee.lastName}`.trim(),
    );
  }
  for (const document of activityDocuments) {
    setSubject("DocumentGenerationArtifact", document.id, document.title);
  }
  for (const version of activityTemplateVersions) {
    setSubject("DocumentTemplateVersion", version.id, `Modeli ${version.template.name}`);
  }

  const activitySubject = (entityType: string, entityId: string) =>
    activitySubjectByKey.get(`${entityType}:${entityId}`) ?? entityLabel(entityType);

  const settingsRow = await prisma.payrollSettings.findUnique({
    where: { companyId },
    select: { minimumSalaryMonthly: true },
  });

  const registerPdfGenerated =
    payrollRow != null
      ? (await prisma.payrollGeneratedDocument.count({
          where: { payrollId: payrollRow.id, kind: "REGISTER_WITH_TOTALS" },
        })) > 0
      : false;

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
    grossHistory: payrollHistoryPeriods
      .map((period) => {
        const totals = payrollHistoryGrossGroups.find((group) => group.payrollId === period.id);
        return totals
          ? {
              year: period.year,
              month: period.month,
              grossSalary: decStr(totals._sum.grossSalary),
            }
          : null;
      })
      .filter((period): period is NonNullable<typeof period> => period != null)
      .reverse(),
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

  const activityCandidates: DashboardActivityCandidate[] = [];

  for (const a of domainActs) {
    activityCandidates.push({
      id: `da-${a.id}`,
      source: "domain",
      occurredAtIso: a.occurredAt.toISOString(),
      title: a.summary,
      subtitle: activitySubject(a.entityType, a.entityId),
      actorLabel: actorName(a.actor),
      entityType: a.entityType,
      entityId: a.entityId,
      operation: a.verb,
      sourcePriority: 2,
    });
  }

  for (const e of empTimeline) {
    const employeeName = `${e.employee.firstName} ${e.employee.lastName}`.trim();
    const entityType = e.subjectKind ?? "Employee";
    const entityId = e.subjectId ?? e.employeeId;
    activityCandidates.push({
      id: `et-${e.id}`,
      source: "employee_timeline",
      occurredAtIso: e.occurredAt.toISOString(),
      title: e.title,
      subtitle: e.body ? `${employeeName} · ${e.body}` : employeeName,
      actorLabel: actorName(e.actor),
      entityType,
      entityId,
      operation: e.eventType,
      sourcePriority: 3,
    });
  }

  for (const u of audits) {
    const subject = activitySubject(u.entityType, u.entityId);
    activityCandidates.push({
      id: `al-${u.id}`,
      source: "audit",
      occurredAtIso: u.createdAt.toISOString(),
      title: `${entityLabel(u.entityType)}: ${auditActionLabel(u.action)}`,
      subtitle: subject,
      actorLabel: actorName(u.actor),
      entityType: u.entityType,
      entityId: u.entityId,
      operation: u.action,
      sourcePriority: 1,
    });
  }

  for (const d of docTimeline) {
    const emp =
      d.employee != null ? `${d.employee.firstName} ${d.employee.lastName}` : undefined;
    activityCandidates.push({
      id: `dt-${d.id}`,
      source: "document_timeline",
      occurredAtIso: d.createdAt.toISOString(),
      title: d.generatedDocument.title,
      subtitle: emp ?? "Dokument",
      actorLabel: actorName(d.createdBy),
      entityType: "DocumentGenerationArtifact",
      entityId: d.generatedDocumentId,
      operation: d.eventType,
      sourcePriority: 3,
    });
  }

  const timeline: TimelineEntryDto[] = collapseDashboardActivity(activityCandidates).slice(0, 30);

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

  const payloadWithoutAlerts: Omit<DashboardOperationalPayload, "alerts" | "recommendedActions"> = {
    filters,
    summary,
    payroll,
    contractExpiries,
    leavePending,
    leaveToday: { approved: leaveApprovedToday, rejected: leaveRejectedToday },
    timeline,
    distribution,
  };

  const documentsMissingEmployees = documentsMissingRows.map((e) => ({
    id: e.id,
    fullName: `${e.firstName} ${e.lastName}`.trim(),
  }));

  // Residence-permit expiry for foreign nationals (Shtetas i huaj) — company-wide
  // compliance, deliberately not narrowed by the department filter.
  const permitNow = new Date();
  const permitHorizon = new Date(permitNow.getTime() + 60 * 24 * 60 * 60 * 1000);
  const permitRows = await prisma.employee.findMany({
    where: {
      companyId,
      isForeignNational: true,
      status: { not: "TERMINATED" },
      residencePermitExpiryDate: { not: null, lte: permitHorizon },
    },
    select: { residencePermitExpiryDate: true },
  });
  const expiredResidencePermits = permitRows.filter(
    (r) => r.residencePermitExpiryDate != null && r.residencePermitExpiryDate < permitNow,
  ).length;

  const alerts = buildOperationalAlerts({
    ...payloadWithoutAlerts,
    payrollSettingsPresent: settingsRow != null,
    belowMinimumEmployees: belowMin,
    documentsMissingEmployees,
    openPayrollCorrections: correctionsOpen,
    expiringContractsTotal: contractsExpiringWithin30Days,
    expiringResidencePermits: permitRows.length,
    expiredResidencePermits,
    payrollRowExists: payrollRow != null,
    registerPdfGenerated,
  });

  const recommendedActions = buildRecommendedActions({
    ...payloadWithoutAlerts,
    payrollRowExists: payrollRow != null,
    documentsMissingEmployees,
    registerPdfGenerated,
  });

  return { ...payloadWithoutAlerts, alerts, recommendedActions };
}
