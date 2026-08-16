import type { LeaveRequestStatus, LeaveType, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { CARRY_EXPIRY_SOON_DAYS } from "@/modules/leaves/helpers/leave-balance-attention";
import { leaveTypesWithBalance } from "@/modules/leaves/helpers/leave-type-metadata";

export type LeaveListFilters = {
  employeeId?: string;
  departmentId?: string;
  type?: LeaveType;
  status?: LeaveRequestStatus;
  year?: number;
  month?: number;
};

function leaveWhere(companyId: string, filters: LeaveListFilters): Prisma.LeaveRequestWhereInput {
  const where: Prisma.LeaveRequestWhereInput = { companyId };

  if (filters.employeeId) where.employeeId = filters.employeeId;
  if (filters.type) where.type = filters.type;
  if (filters.status) where.status = filters.status;
  if (filters.departmentId) {
    where.employee = { departmentId: filters.departmentId };
  }
  if (filters.year != null && filters.month != null && filters.month >= 1 && filters.month <= 12) {
    const start = new Date(Date.UTC(filters.year, filters.month - 1, 1, 0, 0, 0, 0));
    const end = new Date(Date.UTC(filters.year, filters.month, 0, 23, 59, 59, 999));
    where.AND = [{ startDate: { lte: end } }, { endDate: { gte: start } }];
  } else if (filters.year != null) {
    const start = new Date(Date.UTC(filters.year, 0, 1, 0, 0, 0, 0));
    const end = new Date(Date.UTC(filters.year, 11, 31, 23, 59, 59, 999));
    where.AND = [{ startDate: { lte: end } }, { endDate: { gte: start } }];
  }

  return where;
}

const LEAVE_ROW_INCLUDE = {
  employee: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      jobTitle: true,
      departmentId: true,
      department: { select: { name: true } },
    },
  },
  decidedByMembership: {
    select: { user: { select: { displayName: true, email: true } } },
  },
} as const;

/**
 * The archive additionally reports whether a request has an archived document.
 *
 * The calendar and the "who is off today" card never render that, and the
 * calendar query is capped at 400 rows — loading the relation there would cost
 * an extra round trip on every page view to build something immediately thrown
 * away. So only the paged list and the export ask for it.
 */
const LEAVE_ROW_INCLUDE_WITH_DOCUMENTS = {
  ...LEAVE_ROW_INCLUDE,
  documents: {
    select: { id: true, generatedDocumentId: true },
    orderBy: { createdAt: "desc" },
  },
} as const;

export const LEAVE_PAGE_SIZE = 50;

/**
 * Ceiling for one CSV. Reached only by a company with years of history and no
 * filter applied; the caller is told when it bites rather than handed a short
 * file that looks complete.
 */
export const LEAVE_EXPORT_MAX_ROWS = 5000;

/**
 * The filtered list for the CSV export — same `where` as the screen, no paging.
 *
 * Fetches one row past the cap so truncation is a fact rather than an
 * assumption: a file silently cut at exactly N reads as a complete file.
 */
export async function listLeaveRequestsForExport(
  companyId: string,
  filters: LeaveListFilters,
): Promise<{
  rows: Awaited<ReturnType<typeof listLeaveRequestsPage>>["rows"];
  truncated: boolean;
}> {
  const found = await prisma.leaveRequest.findMany({
    where: leaveWhere(companyId, filters),
    orderBy: [{ startDate: "desc" }],
    take: LEAVE_EXPORT_MAX_ROWS + 1,
    include: LEAVE_ROW_INCLUDE_WITH_DOCUMENTS,
  });

  return {
    rows: found.slice(0, LEAVE_EXPORT_MAX_ROWS),
    truncated: found.length > LEAVE_EXPORT_MAX_ROWS,
  };
}

export async function listLeaveRequestsFiltered(companyId: string, filters: LeaveListFilters) {
  return prisma.leaveRequest.findMany({
    where: leaveWhere(companyId, filters),
    orderBy: [{ startDate: "desc" }],
    take: 400,
    include: LEAVE_ROW_INCLUDE,
  });
}

/**
 * The wallchart's feed: the same employee/department/type/status filters as
 * the list, but over an explicit UTC day range instead of the year/month
 * window — a six-week grid borrows days from the neighbouring months, and
 * absences on those borrowed days must still draw.
 */
export async function listLeaveRequestsForWallchart(
  companyId: string,
  filters: LeaveListFilters,
  rangeStart: Date,
  rangeEnd: Date,
) {
  const where = leaveWhere(companyId, { ...filters, year: undefined, month: undefined });
  return prisma.leaveRequest.findMany({
    where: { ...where, AND: [{ startDate: { lte: rangeEnd } }, { endDate: { gte: rangeStart } }] },
    orderBy: [{ startDate: "asc" }],
    take: 400,
    include: LEAVE_ROW_INCLUDE,
  });
}

/**
 * Everyone the wallchart draws a row for — including people with no absence,
 * because "who is NOT away that week" is half of what a wallchart answers.
 * Ordered so department groups come out contiguous.
 */
export async function listWallchartRoster(companyId: string) {
  return prisma.employee.findMany({
    where: { companyId, status: { not: "TERMINATED" } },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      jobTitle: true,
      departmentId: true,
      department: { select: { name: true } },
    },
    orderBy: [{ department: { name: "asc" } }, { lastName: "asc" }, { firstName: "asc" }],
    take: 500,
  });
}

/**
 * The filtered list, split into what needs a decision and what does not.
 *
 * Pending requests are returned whole and are *not* part of the pagination —
 * pinning something to the top only to have page 2 hide it would defeat the
 * point. Sorting by status in the database would not work either: Postgres
 * orders an enum by declaration order, which puts DRAFT above PENDING.
 *
 * Everything else is paged, oldest decision last.
 */
export async function listLeaveRequestsPage(
  companyId: string,
  filters: LeaveListFilters,
  page = 1,
) {
  const where = leaveWhere(companyId, filters);
  const safePage = Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;

  const restWhere: Prisma.LeaveRequestWhereInput = {
    ...where,
    status: filters.status ?? { not: "PENDING" },
  };
  // An explicit PENDING filter means the user asked for exactly that list, so
  // the pinned block carries it and the paged remainder is empty.
  const pendingOnly = filters.status === "PENDING";

  const [pending, total, rows] = await Promise.all([
    prisma.leaveRequest.findMany({
      where: { ...where, status: "PENDING" },
      orderBy: [{ startDate: "asc" }],
      take: 200,
      include: LEAVE_ROW_INCLUDE_WITH_DOCUMENTS,
    }),
    pendingOnly ? Promise.resolve(0) : prisma.leaveRequest.count({ where: restWhere }),
    pendingOnly
      ? Promise.resolve([])
      : prisma.leaveRequest.findMany({
          where: restWhere,
          orderBy: [{ startDate: "desc" }],
          skip: (safePage - 1) * LEAVE_PAGE_SIZE,
          take: LEAVE_PAGE_SIZE,
          include: LEAVE_ROW_INCLUDE_WITH_DOCUMENTS,
        }),
  ]);

  return {
    pending,
    rows,
    total,
    page: safePage,
    pageSize: LEAVE_PAGE_SIZE,
    pageCount: Math.max(1, Math.ceil(total / LEAVE_PAGE_SIZE)),
  };
}

/**
 * Who is actually off right now.
 *
 * This used to be derived client-side from whichever month the calendar was
 * showing, so paging to August answered "who is off today" with August's
 * absences. It is a question about today and nothing else.
 */
export async function listOnLeaveToday(companyId: string, now = new Date()) {
  const dayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000 - 1);

  return prisma.leaveRequest.findMany({
    where: {
      companyId,
      status: "APPROVED",
      startDate: { lte: dayEnd },
      endDate: { gte: dayStart },
    },
    orderBy: [{ endDate: "asc" }],
    take: 100,
    include: LEAVE_ROW_INCLUDE,
  });
}

/**
 * Approved leave whose payroll hours never landed. Stale payroll is otherwise
 * only discoverable by opening one request's timeline and reading it.
 */
export interface LeaveBalanceTotals {
  employees: number;
  yearlyQuota: string;
  carryOverDays: string;
  accruedYtd: string;
  usedDays: string;
  pendingDays: string;
  remainingDays: string;
  /**
   * Employees in day-debt, counted by the database for the same reason the sums
   * are: the panel's list is capped, and a tile that disagreed with the footer
   * beneath it on the same card would be worse than no tile.
   */
  negativeCount: number;
  /** Employees whose carried-over days expire within the engine's 45-day window. */
  carryExpiringSoonCount: number;
  /** Distinct engine versions behind these rows — more than one means the sum mixes definitions. */
  ruleVersions: string[];
}

/**
 * The company's leave position for a year.
 *
 * Computed by the database, not by adding up the rows on screen: that list is
 * capped at 400, so summing it would quietly under-report every company past
 * roughly 130 employees and the total would change as filters moved. The same
 * exclusions as the panel apply — departed staff are out, and an employee
 * filter narrows this too, so the footer always describes the rows above it.
 */
export async function leaveBalanceTotals(
  companyId: string,
  year: number,
  leaveType: LeaveType,
  employeeId?: string | null,
): Promise<LeaveBalanceTotals> {
  const where = {
    companyId,
    year,
    leaveType,
    ...(employeeId ? { employeeId } : {}),
    employee: { status: { not: "TERMINATED" as const } },
  };

  // Both counts join the batch already in flight rather than adding a round trip.
  const now = new Date();
  const carryHorizon = new Date(now.getTime() + CARRY_EXPIRY_SOON_DAYS * 86_400_000);

  const [agg, versions, negativeCount, carryExpiringSoonCount] = await Promise.all([
    prisma.leaveBalance.aggregate({
      where,
      _count: { _all: true },
      _sum: {
        yearlyQuota: true,
        carryOverDays: true,
        accruedYtd: true,
        usedDays: true,
        pendingDays: true,
        remainingDays: true,
      },
    }),
    prisma.leaveBalance.groupBy({
      by: ["computedFromRuleVersion"],
      where,
    }),
    prisma.leaveBalance.count({ where: { ...where, remainingDays: { lt: 0 } } }),
    prisma.leaveBalance.count({
      where: {
        ...where,
        carryOverDays: { gt: 0 },
        carryExpiresAt: { gte: now, lte: carryHorizon },
      },
    }),
  ]);

  const n = (v: { toString(): string } | null | undefined): string =>
    v == null ? "0.00" : Number(v.toString()).toFixed(2);

  return {
    employees: agg._count._all,
    yearlyQuota: n(agg._sum.yearlyQuota),
    carryOverDays: n(agg._sum.carryOverDays),
    accruedYtd: n(agg._sum.accruedYtd),
    usedDays: n(agg._sum.usedDays),
    pendingDays: n(agg._sum.pendingDays),
    remainingDays: n(agg._sum.remainingDays),
    negativeCount,
    carryExpiringSoonCount,
    ruleVersions: versions
      .map((v) => v.computedFromRuleVersion)
      .filter((v): v is string => Boolean(v))
      .sort(),
  };
}

export interface PayrollSyncSkipRow {
  id: string;
  employeeName: string;
  /** Albanian sentence the timeline event already carries. */
  reason: string;
  occurredAtIso: string;
}

/**
 * The approved leave whose hours never reached a payroll, named.
 *
 * The banner used to print a bare count and tell the operator to go and fix it
 * somewhere else, without saying who or why — the information was already on
 * the timeline event the whole time.
 */
export async function listPayrollSyncSkips(
  companyId: string,
  sinceDays = 60,
  take = 25,
): Promise<PayrollSyncSkipRow[]> {
  const since = new Date(Date.now() - sinceDays * 24 * 60 * 60 * 1000);
  const rows = await prisma.employeeTimelineEvent.findMany({
    where: {
      companyId,
      eventType: "LEAVE_PAYROLL_SYNC_SKIPPED",
      occurredAt: { gte: since },
    },
    orderBy: { occurredAt: "desc" },
    take,
    select: {
      id: true,
      title: true,
      body: true,
      occurredAt: true,
      employee: { select: { firstName: true, lastName: true } },
    },
  });
  return rows.map((r) => ({
    id: r.id,
    employeeName: `${r.employee.firstName} ${r.employee.lastName}`.trim(),
    reason: (r.body ?? r.title ?? "").trim(),
    occurredAtIso: r.occurredAt.toISOString(),
  }));
}

export async function countPayrollSyncSkips(companyId: string, sinceDays = 60): Promise<number> {
  const since = new Date(Date.now() - sinceDays * 24 * 60 * 60 * 1000);
  return prisma.employeeTimelineEvent.count({
    where: {
      companyId,
      eventType: "LEAVE_PAYROLL_SYNC_SKIPPED",
      occurredAt: { gte: since },
    },
  });
}

/**
 * The last month the accrual job posted for. It has no scheduler — the only
 * trigger is a person clicking a button in Konfigurime — so silence is
 * indistinguishable from success unless this is on screen.
 */
export async function latestAccrualPeriod(
  companyId: string,
): Promise<{ year: number; month: number } | null> {
  const row = await prisma.leaveAccrualLedger.findFirst({
    where: { companyId },
    orderBy: [{ periodYear: "desc" }, { periodMonth: "desc" }],
    select: { periodYear: true, periodMonth: true },
  });
  return row ? { year: row.periodYear, month: row.periodMonth } : null;
}

/** True when the year has no balance rows at all — a company's first visit. */
export async function hasLeaveBalancesForYear(companyId: string, year: number): Promise<boolean> {
  const count = await prisma.leaveBalance.count({ where: { companyId, year } });
  return count > 0;
}

export async function getLeaveRequestDetail(companyId: string, leaveId: string) {
  return prisma.leaveRequest.findFirst({
    where: { id: leaveId, companyId },
    include: {
      employee: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          jobTitle: true,
          department: { select: { id: true, name: true } },
        },
      },
      documents: { include: { artifact: { select: { id: true, title: true, createdAt: true } } } },
      decidedByMembership: {
        select: { user: { select: { displayName: true, email: true } } },
      },
      createdBy: { select: { displayName: true, email: true } },
    },
  });
}

export async function listLeaveTimelineForRequest(companyId: string, leaveId: string) {
  return prisma.employeeTimelineEvent.findMany({
    where: { companyId, subjectKind: "LeaveRequest", subjectId: leaveId },
    orderBy: { occurredAt: "desc" },
    take: 80,
    include: {
      actor: { select: { displayName: true, email: true } },
      actorMembership: { select: { user: { select: { displayName: true, email: true } } } },
    },
  });
}

export async function leaveDashboardStats(companyId: string) {
  const y = new Date().getUTCFullYear();
  const m = new Date().getUTCMonth();
  const monthStart = new Date(Date.UTC(y, m, 1, 0, 0, 0, 0));
  const [pending, approvedMonth, draft] = await Promise.all([
    prisma.leaveRequest.count({ where: { companyId, status: "PENDING" } }),
    prisma.leaveRequest.count({
      where: {
        companyId,
        status: "APPROVED",
        startDate: { gte: monthStart },
      },
    }),
    prisma.leaveRequest.count({ where: { companyId, status: "DRAFT" } }),
  ]);
  return { pending, approvedThisUtcMonth: approvedMonth, draft };
}

/** How many employees any one company-wide picklist or panel will load. */
export const EMPLOYEE_PICKLIST_CAP = 500;

export async function listActiveEmployeesPicklist(companyId: string) {
  return prisma.employee.findMany({
    where: { companyId, status: { not: "TERMINATED" } },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      hireDate: true,
      terminationDate: true,
    },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    take: EMPLOYEE_PICKLIST_CAP,
  });
}

export async function listDepartmentsPicklist(companyId: string) {
  return prisma.department.findMany({
    where: { companyId },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
}

export async function listLeaveTemplatesPicklist(companyId: string) {
  return prisma.documentTemplate.findMany({
    where: { companyId, documentCategory: "LEAVE", isActive: true },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
}

/**
 * Balance rows for the "Pushimi vjetor — bilanci" panel.
 *
 * Leavers are excluded the same way `listActiveEmployeesPicklist` above excludes
 * them. Without this the panel listed people who had left while the filter
 * dropdown on the same screen did not offer them — so HR saw a balance for
 * someone they could not select. Their rows still exist and stay correct
 * (accrual is clipped at the termination date); they simply belong to Largimet,
 * not to a live balance sheet.
 *
 * `employeeId` narrows the panel to one person, which is what the filter bar's
 * employee dropdown is for.
 *
 * The cap is derived rather than picked. `@@unique([companyId, employeeId,
 * leaveType, year])` means exactly one row per employee per type per year, so
 * with an explicit type filter the row count is `employees × 3` and the ceiling
 * follows from the employee ceiling. The old bare `take: 400` filtered by no
 * type at all, which made the arithmetic unprovable and silently truncated the
 * panel at roughly 133 employees — a real problem now that search over this
 * array is how you find a person.
 */
export const BALANCE_OVERVIEW_ROW_CAP = EMPLOYEE_PICKLIST_CAP * leaveTypesWithBalance().length;

export async function listLeaveBalancesOverview(
  companyId: string,
  year: number,
  employeeId?: string | null,
) {
  return prisma.leaveBalance.findMany({
    where: {
      companyId,
      year,
      leaveType: { in: leaveTypesWithBalance() },
      ...(employeeId ? { employeeId } : {}),
      employee: { status: { not: "TERMINATED" } },
    },
    include: {
      employee: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          department: { select: { name: true } },
        },
      },
    },
    orderBy: [{ employee: { lastName: "asc" } }, { leaveType: "asc" }],
    take: BALANCE_OVERVIEW_ROW_CAP,
  });
}

export async function listPendingLeaveRequests(companyId: string, take = 80) {
  return prisma.leaveRequest.findMany({
    where: { companyId, status: "PENDING" },
    orderBy: { createdAt: "asc" },
    take,
    include: {
      employee: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          departmentId: true,
          department: { select: { name: true } },
        },
      },
    },
  });
}

export async function listUpcomingLeaveForEmployee(companyId: string, employeeId: string) {
  const today = new Date();
  const startOfToday = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  return prisma.leaveRequest.findMany({
    where: {
      companyId,
      employeeId,
      status: { in: ["PENDING", "APPROVED"] },
      endDate: { gte: startOfToday },
    },
    orderBy: { startDate: "asc" },
    take: 24,
  });
}

export async function listLeaveHistoryForEmployee(companyId: string, employeeId: string) {
  return prisma.leaveRequest.findMany({
    where: { companyId, employeeId },
    orderBy: { startDate: "desc" },
    take: 40,
  });
}
