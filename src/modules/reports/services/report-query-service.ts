import type { Prisma, ReportType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { categoryForReportType } from "@/modules/reports/types";
import { REPORT_CATEGORY_LABEL_SQ } from "@/modules/reports/types";

export type GeneratedReportListRow = {
  id: string;
  title: string;
  reportType: ReportType;
  categoryLabel: string;
  fileFormat: string;
  generatedAt: Date;
  isArchived: boolean;
  generatedByDisplay: string | null;
};

export async function listGeneratedReports(
  companyId: string,
  filters?: {
    reportType?: ReportType;
    year?: number;
    month?: number;
    payrollId?: string;
    archivedOnly?: boolean;
    activeOnly?: boolean;
  },
): Promise<GeneratedReportListRow[]> {
  const where: Prisma.GeneratedReportWhereInput = {
    companyId,
    ...(filters?.reportType ? { reportType: filters.reportType } : {}),
    ...(filters?.payrollId ? { filterPayrollId: filters.payrollId } : {}),
    ...(filters?.year !== undefined ? { filterYear: filters.year } : {}),
    ...(filters?.month !== undefined ? { filterMonth: filters.month } : {}),
    ...(filters?.archivedOnly ? { isArchived: true } : {}),
    ...(filters?.activeOnly ? { isArchived: false } : {}),
  };

  const rows = await prisma.generatedReport.findMany({
    where,
    orderBy: { generatedAt: "desc" },
    take: 200,
    include: {
      generatedBy: { select: { displayName: true, email: true } },
    },
  });

  return rows.map((r) => {
    const cat = categoryForReportType(r.reportType);
    return {
      id: r.id,
      title: r.title,
      reportType: r.reportType,
      categoryLabel: REPORT_CATEGORY_LABEL_SQ[cat],
      fileFormat: r.fileFormat,
      generatedAt: r.generatedAt,
      isArchived: r.isArchived,
      generatedByDisplay: r.generatedBy?.displayName ?? r.generatedBy?.email ?? null,
    };
  });
}

export async function getGeneratedReportDetail(companyId: string, id: string) {
  return prisma.generatedReport.findFirst({
    where: { id, companyId },
    include: {
      generatedBy: { select: { displayName: true, email: true } },
      exportLogs: {
        orderBy: { performedAt: "desc" },
        take: 80,
        include: {
          performedBy: { select: { displayName: true, email: true } },
        },
      },
    },
  });
}

export async function loadReportPickerContext(companyId: string) {
  const [departments, payrolls, employees] = await Promise.all([
    prisma.department.findMany({
      where: { companyId },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.payroll.findMany({
      where: { companyId },
      select: { id: true, year: true, month: true, status: true },
      orderBy: [{ year: "desc" }, { month: "desc" }],
      take: 36,
    }),
    prisma.employee.findMany({
      where: { companyId },
      select: { id: true, firstName: true, lastName: true },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      take: 800,
    }),
  ]);

  return {
    departments,
    payrolls,
    employees,
  };
}
