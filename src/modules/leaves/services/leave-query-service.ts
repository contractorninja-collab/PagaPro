import type { LeaveRequestStatus, LeaveType, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type LeaveListFilters = {
  employeeId?: string;
  departmentId?: string;
  type?: LeaveType;
  status?: LeaveRequestStatus;
  year?: number;
  month?: number;
};

export async function listLeaveRequestsFiltered(companyId: string, filters: LeaveListFilters) {
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

  return prisma.leaveRequest.findMany({
    where,
    orderBy: [{ startDate: "desc" }],
    take: 400,
    include: {
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
    },
  });
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
    take: 500,
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

export async function listLeaveBalancesOverview(companyId: string, year: number) {
  return prisma.leaveBalance.findMany({
    where: { companyId, year },
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
    take: 400,
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
