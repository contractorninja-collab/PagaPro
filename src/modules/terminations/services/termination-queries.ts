import type { Prisma, TerminationStatus, TerminationType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { TERMINATION_ENTITY, TERMINATION_TIMELINE } from "@/modules/terminations/types";
import { TIMELINE_TYPES } from "@/modules/employees/services/employee-audit";

const TERMINATION_TIMELINE_TYPES = [
  ...Object.values(TERMINATION_TIMELINE),
  TIMELINE_TYPES.TERMINATED,
];

export interface TerminationListFilters {
  status?: string;
  type?: string;
  employeeId?: string;
  year?: number;
  month?: number;
}

export async function listTerminationsForCompany(companyId: string, filters: TerminationListFilters) {
  const where: Prisma.TerminationWhereInput = { companyId };

  if (filters.status && filters.status !== "ALL") {
    where.status = filters.status as TerminationStatus;
  }
  if (filters.type && filters.type !== "ALL") {
    where.type = filters.type as TerminationType;
  }
  if (filters.employeeId) {
    where.employeeId = filters.employeeId;
  }
  if (filters.year != null && filters.month != null) {
    const start = new Date(Date.UTC(filters.year, filters.month - 1, 1));
    const end = new Date(Date.UTC(filters.year, filters.month, 0, 23, 59, 59, 999));
    where.terminationDate = { gte: start, lte: end };
  } else if (filters.year != null) {
    const start = new Date(Date.UTC(filters.year, 0, 1));
    const end = new Date(Date.UTC(filters.year, 11, 31, 23, 59, 59, 999));
    where.terminationDate = { gte: start, lte: end };
  }

  return prisma.termination.findMany({
    where,
    orderBy: [{ terminationDate: "desc" }, { createdAt: "desc" }],
    include: {
      employee: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          personalId: true,
          jobTitle: true,
          status: true,
        },
      },
      finalPayroll: { select: { id: true, year: true, month: true, status: true } },
      generatedDocument: {
        select: {
          id: true,
          displayFilename: true,
          generationStatus: true,
          generatedPdfStorageKey: true,
          generatedDocxStorageKey: true,
        },
      },
    },
    take: 500,
  });
}

export async function getTerminationDetailBundle(companyId: string, terminationId: string) {
  const termination = await prisma.termination.findFirst({
    where: { id: terminationId, companyId },
    include: {
      employee: { include: { department: { select: { id: true, name: true } } } },
      checklists: { orderBy: { itemKey: "asc" } },
      finalPayroll: true,
      generatedDocument: true,
      approvedBy: { select: { id: true, displayName: true, email: true } },
      createdBy: { select: { id: true, displayName: true, email: true } },
    },
  });
  if (!termination) return null;

  const artifacts = await prisma.documentGenerationArtifact.findMany({
    where: {
      companyId,
      subjectKind: "TERMINATION",
      subjectId: terminationId,
    },
    orderBy: { createdAt: "desc" },
    take: 25,
    select: {
      id: true,
      title: true,
      displayFilename: true,
      kind: true,
      generationStatus: true,
      createdAt: true,
      isArchived: true,
      generatedPdfStorageKey: true,
      generatedDocxStorageKey: true,
    },
  });

  const payrollEntry =
    termination.finalPayrollId != null
      ? await prisma.payrollEntry.findFirst({
          where: {
            payrollId: termination.finalPayrollId,
            employeeId: termination.employeeId,
          },
          select: {
            id: true,
            status: true,
            netPay: true,
            grossSalary: true,
          },
        })
      : null;

  const timeline = await prisma.employeeTimelineEvent.findMany({
    where: {
      companyId,
      employeeId: termination.employeeId,
      eventType: { in: TERMINATION_TIMELINE_TYPES },
    },
    orderBy: { occurredAt: "desc" },
    take: 80,
  });

  const activities = await prisma.domainActivity.findMany({
    where: {
      companyId,
      entityType: TERMINATION_ENTITY,
      entityId: terminationId,
    },
    orderBy: { occurredAt: "desc" },
    take: 80,
    include: {
      actor: { select: { id: true, displayName: true, email: true } },
    },
  });

  const audits = await prisma.auditLog.findMany({
    where: {
      companyId,
      entityType: TERMINATION_ENTITY,
      entityId: terminationId,
    },
    orderBy: { id: "desc" },
    take: 80,
    include: {
      actor: { select: { id: true, displayName: true, email: true } },
    },
  });

  return {
    termination,
    artifacts,
    payrollEntry,
    timeline,
    activities,
    audits,
  };
}

export async function listEmployeesForTerminationPicker(companyId: string) {
  return prisma.employee.findMany({
    where: {
      companyId,
      status: { not: "TERMINATED" },
      employmentType: "EMPLOYEE",
    },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    select: {
      id: true,
      firstName: true,
      lastName: true,
      personalId: true,
      jobTitle: true,
      hireDate: true,
    },
    take: 2000,
  });
}
