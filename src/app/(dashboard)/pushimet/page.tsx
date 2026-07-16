import type { Metadata } from "next";
import { Suspense } from "react";
import type { LeaveRequestStatus, LeaveSubtype, LeaveType } from "@prisma/client";
import { syncLeaveBalancesForCompanyYear } from "@/modules/leaves/services/leave-balance-service";
import {
  leaveDashboardStats,
  listActiveEmployeesPicklist,
  listDepartmentsPicklist,
  listLeaveBalancesOverview,
  listLeaveRequestsFiltered,
  listLeaveTemplatesPicklist,
  listPendingLeaveRequests,
} from "@/modules/leaves/services/leave-query-service";
import { AppSubBar } from "@/components/layout/app-sub-bar";
import { PushimetFiltersForm } from "@/modules/leaves/components/pushimet-filters-form";
import { PushimetDashboardClient } from "@/modules/leaves/components/pushimet-dashboard-client";
import type {
  PushimetBalanceRowDto,
  PushimetCalendarChipDto,
  PushimetDepartmentOptionDto,
  PushimetEmployeeOptionDto,
  PushimetLeaveRowDto,
  PushimetTemplateOptionDto,
} from "@/modules/leaves/types/pushimet";
import { eligibleLeaveYears } from "@/modules/leaves/helpers/eligible-leave-years";
import { requireCompanyContextPage } from "@/server/company-context";

export const metadata: Metadata = {
  title: "Pushimet",
};

function first(sp: Record<string, string | string[] | undefined>, key: string): string {
  const v = sp[key];
  if (Array.isArray(v)) return v[0] ?? "";
  return v ?? "";
}

const LEAVE_TYPES = new Set<LeaveType>([
  "PUSHIM_VJETOR",
  "PUSHIM_MJEKESOR",
  "PUSHIM_PERSONAL",
  "PUSHIM_PA_PAGESE",
  "PUSHIM_LEHONIE",
  "TJETER",
]);

const STATUSES = new Set<LeaveRequestStatus>(["DRAFT", "PENDING", "APPROVED", "REJECTED", "CANCELLED"]);

function serializeLeaveRow(
  lr: {
    id: string;
    employeeId: string;
    type: LeaveType;
    subtype: LeaveSubtype;
    interruptedByLeaveRequestId: string | null;
    status: LeaveRequestStatus;
    startDate: Date;
    endDate: Date;
    totalDays: { toString(): string } | null | undefined;
    workingDays: { toString(): string } | null | undefined;
    totalHours: { toString(): string } | null | undefined;
    isPaid: boolean;
    affectsPayroll: boolean;
    reason: string | null;
    rejectionReason: string | null;
    decidedAt: Date | null;
    employee: {
      firstName: string;
      lastName: string;
      department: { name: string } | null;
    };
    decidedByMembership?:
      | {
          user: { displayName: string | null; email: string | null };
        }
      | null;
  },
): PushimetLeaveRowDto {
  return {
    id: lr.id,
    employeeId: lr.employeeId,
    employeeName: `${lr.employee.firstName} ${lr.employee.lastName}`.trim(),
    departmentName: lr.employee.department?.name ?? null,
    type: lr.type,
    subtype: lr.subtype,
    interruptedByLeaveRequestId: lr.interruptedByLeaveRequestId,
    status: lr.status,
    startDateIso: lr.startDate.toISOString(),
    endDateIso: lr.endDate.toISOString(),
    totalDays: lr.totalDays?.toString() ?? null,
    workingDays: lr.workingDays?.toString() ?? null,
    totalHours: lr.totalHours?.toString() ?? null,
    isPaid: lr.isPaid,
    affectsPayroll: lr.affectsPayroll,
    reason: lr.reason,
    rejectionReason: lr.rejectionReason,
    decidedAtIso: lr.decidedAt?.toISOString() ?? null,
    decidedByLabel:
      lr.decidedByMembership?.user.displayName?.trim() ||
      lr.decidedByMembership?.user.email?.trim() ||
      null,
  };
}

function readAnnualBreakdown(
  bd: unknown,
): { projected: number | null; base: number; tenure: number; special: number } | null {
  if (!bd || typeof bd !== "object") return null;
  const ent = (bd as { entitlement?: unknown }).entitlement;
  if (!ent || typeof ent !== "object") return null;
  const e = ent as Record<string, unknown>;
  const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);
  return {
    projected: num(e.remainingYearlyDays),
    base: num(e.baseAnnualDays) ?? 0,
    tenure: num(e.experienceExtraDays) ?? 0,
    special: num(e.protectedCategoryExtraDays) ?? 0,
  };
}

const round2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;

function chipFromRow(row: PushimetLeaveRowDto): PushimetCalendarChipDto {
  return {
    id: row.id,
    employeeId: row.employeeId,
    employeeName: row.employeeName,
    startDateIso: row.startDateIso,
    endDateIso: row.endDateIso,
    status: row.status,
    type: row.type,
  };
}

function DashboardFallback() {
  return (
    <div className="animate-pulse space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="h-[72px] rounded-xl border border-[#e2e8f0] bg-white" />
        <div className="h-[72px] rounded-xl border border-[#e2e8f0] bg-white" />
        <div className="h-[72px] rounded-xl border border-[#e2e8f0] bg-white" />
        <div className="h-[72px] rounded-xl border border-[#e2e8f0] bg-white" />
      </div>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-6">
          <div className="h-40 rounded-xl border border-[#e2e8f0] bg-white" />
          <div className="h-64 rounded-xl border border-[#e2e8f0] bg-white" />
        </div>
        <div className="h-72 rounded-xl border border-[#e2e8f0] bg-white" />
      </div>
    </div>
  );
}

export default async function PushimetPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { companyId } = await requireCompanyContextPage();

  const sp = await searchParams;
  const now = new Date();
  const defaultYear = now.getUTCFullYear();
  const defaultMonth = now.getUTCMonth() + 1;

  const employeeId = first(sp, "employeeId");
  const departmentId = first(sp, "departmentId");
  const typeRaw = first(sp, "type");
  const statusRaw = first(sp, "status");
  const yearRaw = first(sp, "year");
  const monthRaw = first(sp, "month");

  const filterYear = Number(yearRaw);
  const filterMonth = Number(monthRaw);
  const year = Number.isFinite(filterYear) ? filterYear : defaultYear;
  const month = Number.isFinite(filterMonth) && filterMonth >= 1 && filterMonth <= 12 ? filterMonth : defaultMonth;

  const filters = {
    employeeId: employeeId || undefined,
    departmentId: departmentId || undefined,
    type: LEAVE_TYPES.has(typeRaw as LeaveType) ? (typeRaw as LeaveType) : undefined,
    status: STATUSES.has(statusRaw as LeaveRequestStatus) ? (statusRaw as LeaveRequestStatus) : undefined,
    year,
    month,
  };

  let rowsRaw;
  let pendingRaw;
  let stats;
  let employeesRaw;
  let departmentsRaw;
  let templatesRaw;
  let balancesRaw;
  try {
    await syncLeaveBalancesForCompanyYear(companyId, year);
    ;[rowsRaw, pendingRaw, stats, employeesRaw, departmentsRaw, templatesRaw, balancesRaw] = await Promise.all([
      listLeaveRequestsFiltered(companyId, filters),
      listPendingLeaveRequests(companyId),
      leaveDashboardStats(companyId),
      listActiveEmployeesPicklist(companyId),
      listDepartmentsPicklist(companyId),
      listLeaveTemplatesPicklist(companyId),
      listLeaveBalancesOverview(companyId, year),
    ]);
  } catch (err) {
    console.error("[pagapro] PushimetPage: query failed", err);
    return (
      <div className="mx-auto max-w-xl py-12">
        <p className="text-sm font-medium text-destructive">
          Nuk mund të lexohen të dhënat e pushimeve. Verifikoni migrimet Prisma.
        </p>
      </div>
    );
  }

  const rows = rowsRaw.map(serializeLeaveRow);
  const chips = rows.map(chipFromRow);
  const pendingRows = pendingRaw.map(serializeLeaveRow);

  const employees: PushimetEmployeeOptionDto[] = employeesRaw.map((e) => ({
    id: e.id,
    label: `${e.firstName} ${e.lastName}`.trim(),
    eligibleYears: eligibleLeaveYears(e.hireDate, e.terminationDate, defaultYear),
  }));

  const departments: PushimetDepartmentOptionDto[] = departmentsRaw.map((d) => ({
    id: d.id,
    name: d.name,
  }));

  const templates: PushimetTemplateOptionDto[] = templatesRaw.map((t) => ({
    id: t.id,
    name: t.name,
  }));

  const balances: PushimetBalanceRowDto[] = balancesRaw.map((b) => {
    const isAnnual = b.leaveType === "PUSHIM_VJETOR";
    const bd = isAnnual ? readAnnualBreakdown(b.breakdown) : null;
    return {
      id: b.id,
      employeeId: b.employeeId,
      employeeName: `${b.employee.firstName} ${b.employee.lastName}`.trim(),
      departmentName: b.employee.department?.name ?? null,
      leaveType: b.leaveType,
      year: b.year,
      yearlyQuota: b.yearlyQuota.toString(),
      accruedDays: b.accruedYtd.toString(),
      carryOverDays: b.carryOverDays.toString(),
      usedDays: b.usedDays.toString(),
      pendingDays: b.pendingDays.toString(),
      remainingDays: b.remainingDays.toString(),
      projectedYearEndDays: bd?.projected != null ? String(round2(bd.projected)) : null,
      carryExpiresIso: b.carryExpiresAt ? b.carryExpiresAt.toISOString() : null,
      entitlementBreakdown: bd ? { base: bd.base, tenure: bd.tenure, special: bd.special } : null,
    };
  });

  return (
    <>
      <AppSubBar
        eyebrow="Menaxhimi i pushimeve"
        title="Pushimet"
        description="Rrjedhë operative për kërkesat, miratimet, balancat dhe lidhjen me payroll dhe dokumentet, të izoluara sipas kompanisë aktive."
      />
      <div className="space-y-6">
      <PushimetFiltersForm
        employees={employees}
        departments={departments}
        defaults={{
          employeeId,
          departmentId,
          type: LEAVE_TYPES.has(typeRaw as LeaveType) ? typeRaw : "",
          status: STATUSES.has(statusRaw as LeaveRequestStatus) ? statusRaw : "",
          year: String(year),
          month: String(month),
        }}
      />

      <Suspense fallback={<DashboardFallback />}>
        <PushimetDashboardClient
          stats={stats}
          rows={rows}
          pendingRows={pendingRows}
          chips={chips}
          calendarYear={year}
          calendarMonth={month}
          balances={balances}
          employees={employees}
          templates={templates}
        />
      </Suspense>
      </div>
    </>
  );
}
