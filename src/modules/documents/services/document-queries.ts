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

export const DOCUMENTS_PAGE_SIZE = 50;

/** Turns the page's filter set into the `where` both the list and the count use. */
function artifactWhere(
  companyId: string,
  filters: ArtifactListFilters,
): Prisma.DocumentGenerationArtifactWhereInput {
  const where: Prisma.DocumentGenerationArtifactWhereInput = { companyId };

  if (filters.employeeId) where.employeeId = filters.employeeId;
  if (filters.documentCategory) where.documentCategory = filters.documentCategory;
  if (filters.createdByUserId) where.createdByUserId = filters.createdByUserId;

  if (filters.archived === "yes") where.isArchived = true;
  if (filters.archived === "no") where.isArchived = false;

  const window = monthWindow(filters.month);
  if (window) where.createdAt = window;

  const q = filters.q?.trim();
  if (q) {
    where.OR = [
      { title: { contains: q, mode: "insensitive" } },
      { displayFilename: { contains: q, mode: "insensitive" } },
    ];
  }

  return where;
}

export interface ArtifactPage {
  rows: Awaited<ReturnType<typeof findArtifactPage>>;
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
}

function findArtifactPage(where: Prisma.DocumentGenerationArtifactWhereInput, skip: number) {
  return prisma.documentGenerationArtifact.findMany({
    where,
    orderBy: { createdAt: "desc" },
    skip,
    take: DOCUMENTS_PAGE_SIZE,
    include: {
      templateVersion: { include: { template: true } },
      employee: { select: { id: true, firstName: true, lastName: true } },
      createdBy: { select: { id: true, displayName: true, email: true } },
    },
  });
}

/**
 * One page of the register plus the true total.
 *
 * This used to return a flat `take: 250` with no total, and the page counted the
 * returned array — so past 250 documents every figure on the screen was wrong
 * and nothing said the list had been cut.
 */
export async function listDocumentArtifactsPage(
  companyId: string,
  filters: ArtifactListFilters,
  page = 1,
): Promise<ArtifactPage> {
  const where = artifactWhere(companyId, filters);
  const safePage = Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;

  const [total, rows] = await Promise.all([
    prisma.documentGenerationArtifact.count({ where }),
    findArtifactPage(where, (safePage - 1) * DOCUMENTS_PAGE_SIZE),
  ]);

  return {
    rows,
    total,
    page: safePage,
    pageSize: DOCUMENTS_PAGE_SIZE,
    pageCount: Math.max(1, Math.ceil(total / DOCUMENTS_PAGE_SIZE)),
  };
}

function monthWindow(month?: string): { gte: Date; lt: Date } | null {
  if (!month?.trim()) return null;
  const [ys, ms] = month.split("-");
  const y = Number(ys);
  const mo = Number(ms);
  if (!Number.isFinite(y) || !Number.isFinite(mo) || mo < 1 || mo > 12) return null;
  return {
    gte: new Date(Date.UTC(y, mo - 1, 1, 0, 0, 0, 0)),
    lt: new Date(Date.UTC(y, mo, 1, 0, 0, 0, 0)),
  };
}

export interface WarningRegisterRow {
  id: string;
  employeeId: string;
  employeeLabel: string | null;
  measure: string | null;
  summary: string;
  issuedAt: Date;
}

export type DocumentRegisterRow =
  | { rowType: "artifact"; artifact: Awaited<ReturnType<typeof findArtifactPage>>[number] }
  | { rowType: "warning"; warning: WarningRegisterRow };

export interface DocumentRegisterPage {
  rows: DocumentRegisterRow[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
}

/**
 * Warnings that belong on the register for these filters. "Lësho vërejtje"
 * stores a disciplinary_warnings row and renders its document on demand —
 * there is no artifact — so the register lists them from their own table.
 * Filters that cannot apply exclude them honestly: warnings have no archive
 * state (hidden under "vetëm arkivi") and store no author (hidden when the
 * author filter is set).
 */
function warningRegisterWhere(
  companyId: string,
  filters: ArtifactListFilters,
): Prisma.DisciplinaryWarningWhereInput | null {
  if (filters.documentCategory && filters.documentCategory !== "WARNING") return null;
  if (filters.archived === "yes") return null;
  if (filters.createdByUserId) return null;

  const where: Prisma.DisciplinaryWarningWhereInput = {
    companyId,
    status: { not: "VOID" },
  };
  if (filters.employeeId) where.employeeId = filters.employeeId;

  const window = monthWindow(filters.month);
  if (window) where.issuedAt = window;

  const q = filters.q?.trim();
  if (q) {
    where.OR = [
      { summary: { contains: q, mode: "insensitive" } },
      { employee: { firstName: { contains: q, mode: "insensitive" } } },
      { employee: { lastName: { contains: q, mode: "insensitive" } } },
    ];
  }
  return where;
}

/**
 * One page of the register with artifacts AND issued warnings interleaved by
 * date. Both sources are fetched up to the requested window and merge-sorted,
 * so pagination stays correct across the union without a SQL UNION.
 */
export async function listDocumentRegisterPage(
  companyId: string,
  filters: ArtifactListFilters,
  page = 1,
): Promise<DocumentRegisterPage> {
  const safePage = Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;
  const windowEnd = safePage * DOCUMENTS_PAGE_SIZE;

  const artifactsWhere = artifactWhere(companyId, filters);
  const warningsWhere = warningRegisterWhere(companyId, filters);

  const [artifactTotal, artifacts, warningTotal, warnings] = await Promise.all([
    prisma.documentGenerationArtifact.count({ where: artifactsWhere }),
    prisma.documentGenerationArtifact.findMany({
      where: artifactsWhere,
      orderBy: { createdAt: "desc" },
      take: windowEnd,
      include: {
        templateVersion: { include: { template: true } },
        employee: { select: { id: true, firstName: true, lastName: true } },
        createdBy: { select: { id: true, displayName: true, email: true } },
      },
    }),
    warningsWhere ? prisma.disciplinaryWarning.count({ where: warningsWhere }) : Promise.resolve(0),
    warningsWhere
      ? prisma.disciplinaryWarning.findMany({
          where: warningsWhere,
          orderBy: { issuedAt: "desc" },
          take: windowEnd,
          select: {
            id: true,
            employeeId: true,
            issuedAt: true,
            summary: true,
            measure: true,
            employee: { select: { firstName: true, lastName: true } },
          },
        })
      : Promise.resolve([]),
  ]);

  const merged: Array<{ at: number; row: DocumentRegisterRow }> = [
    ...artifacts.map((artifact) => ({
      at: artifact.createdAt.getTime(),
      row: { rowType: "artifact", artifact } satisfies DocumentRegisterRow,
    })),
    ...warnings.map((w) => ({
      at: w.issuedAt.getTime(),
      row: {
        rowType: "warning",
        warning: {
          id: w.id,
          employeeId: w.employeeId,
          employeeLabel: w.employee
            ? `${w.employee.firstName} ${w.employee.lastName}`.trim()
            : null,
          measure: w.measure,
          summary: w.summary,
          issuedAt: w.issuedAt,
        },
      } satisfies DocumentRegisterRow,
    })),
  ];
  merged.sort((a, b) => b.at - a.at);

  const total = artifactTotal + warningTotal;
  return {
    rows: merged.slice((safePage - 1) * DOCUMENTS_PAGE_SIZE, windowEnd).map((m) => m.row),
    total,
    page: safePage,
    pageSize: DOCUMENTS_PAGE_SIZE,
    pageCount: Math.max(1, Math.ceil(total / DOCUMENTS_PAGE_SIZE)),
  };
}

export interface DocumentRegisterCounts {
  /** Total artifacts for the company, ignoring the active filters. */
  total: number;
  final: number;
  preview: number;
  archived: number;
  failed: number;
  /** Documents created in the current calendar month, per category. */
  monthByCategory: Record<DocumentCategory, number>;
}

const EMPTY_CATEGORY_COUNTS: Record<DocumentCategory, number> = {
  CONTRACT: 0,
  LEAVE: 0,
  TERMINATION: 0,
  WARNING: 0,
  PAYROLL: 0,
  OTHER: 0,
};

/**
 * Company-wide totals, grouped in the database. The strip is a statement about
 * the company, so it must not move when the register is filtered or paged.
 */
export async function getDocumentRegisterCounts(
  companyId: string,
  now = new Date(),
): Promise<DocumentRegisterCounts> {
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const monthEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));

  const [byKind, archived, failed, byCategoryThisMonth, total, disciplinaryThisMonth] =
    await Promise.all([
      prisma.documentGenerationArtifact.groupBy({
        by: ["kind"],
        where: { companyId },
        _count: { _all: true },
      }),
      prisma.documentGenerationArtifact.count({ where: { companyId, isArchived: true } }),
      prisma.documentGenerationArtifact.count({
        where: { companyId, generationStatus: "FAILED" },
      }),
      prisma.documentGenerationArtifact.groupBy({
        by: ["documentCategory"],
        where: { companyId, createdAt: { gte: monthStart, lt: monthEnd } },
        _count: { _all: true },
      }),
      prisma.documentGenerationArtifact.count({ where: { companyId } }),
      // "Lësho vërejtje" writes disciplinary_warnings and renders its document
      // on demand — no artifact row exists, so counting artifacts alone showed
      // 0 no matter how many warnings HR issued this month.
      prisma.disciplinaryWarning.count({
        where: {
          companyId,
          status: { not: "VOID" },
          issuedAt: { gte: monthStart, lt: monthEnd },
        },
      }),
    ]);

  const monthByCategory = { ...EMPTY_CATEGORY_COUNTS };
  for (const row of byCategoryThisMonth) {
    monthByCategory[row.documentCategory] = row._count._all;
  }
  monthByCategory.WARNING += disciplinaryThisMonth;

  return {
    total,
    final: byKind.find((r) => r.kind === "ARCHIVED_FINAL")?._count._all ?? 0,
    preview: byKind.find((r) => r.kind === "PREVIEW")?._count._all ?? 0,
    archived,
    failed,
    monthByCategory,
  };
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
      employeeId: true,
      status: true,
      type: true,
      startDate: true,
      endDate: true,
      employee: { select: { firstName: true, lastName: true } },
    },
    orderBy: { startDate: "desc" },
    take: 200,
  });
}

export async function listTerminationsForGeneration(companyId: string) {
  return prisma.termination.findMany({
    where: { companyId },
    select: {
      id: true,
      employeeId: true,
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
      employeeId: true,
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
  /**
   * `artifact.employeeId` alone is not enough: rows written before it was
   * threaded through every generation path carry NULL there, while their
   * subject link (leave request, termination, warning) still names the
   * employee. Match through the subjects too, so the profile shows every
   * document however it was linked. `subjectId` for CONTRACT artifacts is
   * the employee id itself in the current flow and a Contract row id in the
   * legacy one, so both are included.
   */
  const [leaves, terminations, warnings, contracts] = await Promise.all([
    prisma.leaveRequest.findMany({ where: { companyId, employeeId }, select: { id: true } }),
    prisma.termination.findMany({ where: { companyId, employeeId }, select: { id: true } }),
    prisma.disciplinaryWarning.findMany({ where: { companyId, employeeId }, select: { id: true } }),
    prisma.contract.findMany({ where: { companyId, employeeId }, select: { id: true } }),
  ]);
  return prisma.documentGenerationArtifact.findMany({
    where: {
      companyId,
      OR: [
        { employeeId },
        { subjectKind: "LEAVE", subjectId: { in: leaves.map((r) => r.id) } },
        { subjectKind: "TERMINATION", subjectId: { in: terminations.map((r) => r.id) } },
        { subjectKind: "WARNING", subjectId: { in: warnings.map((r) => r.id) } },
        { subjectKind: "CONTRACT", subjectId: { in: [employeeId, ...contracts.map((r) => r.id)] } },
      ],
    },
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
