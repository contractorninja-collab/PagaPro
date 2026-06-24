import type { DocumentCategory, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export async function listDocumentTemplatesWithVersions(companyId: string) {
  return prisma.documentTemplate.findMany({
    where: { companyId },
    orderBy: [{ documentCategory: "asc" }, { name: "asc" }],
    include: {
      versions: { orderBy: { versionNumber: "desc" } },
    },
  });
}

export type ArtifactListFilters = {
  employeeId?: string;
  documentCategory?: DocumentCategory;
  month?: string;
  createdByUserId?: string;
  archived?: "all" | "yes" | "no";
  q?: string;
};

export async function listDocumentArtifacts(companyId: string, filters: ArtifactListFilters) {
  const where: Prisma.DocumentGenerationArtifactWhereInput = { companyId };

  if (filters.employeeId) where.employeeId = filters.employeeId;
  if (filters.documentCategory) where.documentCategory = filters.documentCategory;
  if (filters.createdByUserId) where.createdByUserId = filters.createdByUserId;

  if (filters.archived === "yes") where.isArchived = true;
  if (filters.archived === "no") where.isArchived = false;

  if (filters.month?.trim()) {
    const [ys, ms] = filters.month.split("-");
    const y = Number(ys);
    const mo = Number(ms);
    if (Number.isFinite(y) && Number.isFinite(mo) && mo >= 1 && mo <= 12) {
      const start = new Date(Date.UTC(y, mo - 1, 1, 0, 0, 0, 0));
      const end = new Date(Date.UTC(y, mo, 1, 0, 0, 0, 0));
      where.createdAt = { gte: start, lt: end };
    }
  }

  const q = filters.q?.trim();
  if (q) {
    where.OR = [
      { title: { contains: q, mode: "insensitive" } },
      { displayFilename: { contains: q, mode: "insensitive" } },
    ];
  }

  return prisma.documentGenerationArtifact.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 250,
    include: {
      templateVersion: { include: { template: true } },
      employee: { select: { id: true, firstName: true, lastName: true } },
      createdBy: { select: { id: true, displayName: true, email: true } },
    },
  });
}

export async function getDocumentArtifactDetail(companyId: string, id: string) {
  return prisma.documentGenerationArtifact.findFirst({
    where: { id, companyId },
    include: {
      templateVersion: { include: { template: true } },
      employee: { select: { id: true, firstName: true, lastName: true, personalId: true } },
      payroll: { select: { id: true, year: true, month: true } },
      createdBy: { select: { id: true, displayName: true, email: true } },
      supersedesArtifact: { select: { id: true, title: true, createdAt: true } },
    },
  });
}

export async function listEmployeesForDocumentFilters(companyId: string) {
  return prisma.employee.findMany({
    where: { companyId, status: { not: "TERMINATED" } },
    select: { id: true, firstName: true, lastName: true },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    take: 500,
  });
}

export async function listPayrollsForDocumentFilters(companyId: string) {
  return prisma.payroll.findMany({
    where: { companyId },
    select: { id: true, year: true, month: true, status: true },
    orderBy: [{ year: "desc" }, { month: "desc" }],
    take: 36,
  });
}

export async function listLeaveRequestsForGeneration(companyId: string) {
  return prisma.leaveRequest.findMany({
    where: { companyId },
    select: {
      id: true,
      status: true,
      type: true,
      startDate: true,
      endDate: true,
      employee: { select: { firstName: true, lastName: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
}

export async function listTerminationsForGeneration(companyId: string) {
  return prisma.termination.findMany({
    where: { companyId },
    select: {
      id: true,
      status: true,
      lastWorkingDay: true,
      employee: { select: { firstName: true, lastName: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
}

export async function listWarningsForGeneration(companyId: string) {
  return prisma.disciplinaryWarning.findMany({
    where: { companyId },
    select: {
      id: true,
      status: true,
      issuedAt: true,
      summary: true,
      employee: { select: { firstName: true, lastName: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
}

export async function listArtifactAuthorsForFilter(companyId: string) {
  const rows = await prisma.documentGenerationArtifact.findMany({
    where: { companyId, createdByUserId: { not: null } },
    distinct: ["createdByUserId"],
    select: {
      createdByUserId: true,
      createdBy: { select: { id: true, displayName: true, email: true } },
    },
    take: 100,
  });
  return rows
    .filter((r): r is typeof r & { createdByUserId: string } => r.createdByUserId != null)
    .map((r) => r.createdBy);
}

export async function listArtifactsForEmployee(companyId: string, employeeId: string) {
  return prisma.documentGenerationArtifact.findMany({
    where: { companyId, employeeId },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { templateVersion: { include: { template: true } } },
  });
}

export async function listContractsForEmployee(companyId: string, employeeId: string) {
  return prisma.contract.findMany({
    where: { companyId, employeeId },
    orderBy: { effectiveDate: "desc" },
    select: { id: true, status: true, referenceCode: true, effectiveDate: true },
    take: 50,
  });
}

export async function listPayrollGeneratedDocsForEmployee(companyId: string, employeeId: string) {
  return prisma.payrollGeneratedDocument.findMany({
    where: { companyId, employeeId },
    orderBy: { generatedAt: "desc" },
    include: { payroll: { select: { year: true, month: true } } },
    take: 50,
  });
}

export async function getDocumentTemplateDetail(companyId: string, templateId: string) {
  return prisma.documentTemplate.findFirst({
    where: { id: templateId, companyId },
    include: {
      versions: { orderBy: { versionNumber: "desc" } },
    },
  });
}

export async function listActivePlaceholderRegistry() {
  return prisma.placeholderRegistry.findMany({
    where: { isActive: true },
    orderBy: [{ category: "asc" }, { label: "asc" }],
  });
}
