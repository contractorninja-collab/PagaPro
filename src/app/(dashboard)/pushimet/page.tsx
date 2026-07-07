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
import { resolveActiveCompanyId } from "@/server/company-scope";

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
    <div className="animate-pulse space-y-6 rounded-xl border border-border bg-card p-6">
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="h-24 rounded-lg bg-muted" />
        <div className="h-24 rounded-lg bg-muted" />
        <div className="h-24 rounded-lg bg-muted" />
      </div>
      <div className="h-40 rounded-lg bg-muted" />
      <div className="h-64 rounded-lg bg-muted" />
    </div>
  );
}

export default async function PushimetPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const companyId = await resolveActiveCompanyId();

  if (!companyId) {
    return (
      <div className="mx-auto max-w-xl space-y-4 py-12">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Pushimet</h1>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Nuk ka kompani aktive për këtë sesion. Vendosni cookie-in{" "}
          <code className="rounded bg-muted px-1.5 py-0.5 text-xs">pp_active_company_id</code>, variablën{" "}
          <code className="rounded bg-muted px-1.5 py-0.5 text-xs">DEV_DEFAULT_COMPANY_ID</code>, ose në development
          përdorni <code className="rounded bg-muted px-1.5 py-0.5 text-xs">POST /api/dev/active-company</code>.
        </p>
      </div>
    );
  }

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
  }));

  const departments: PushimetDepartmentOptionDto[] = departmentsRaw.map((d) => ({
    id: d.id,
    name: d.name,
  }));

  const templates: PushimetTemplateOptionDto[] = templatesRaw.map((t) => ({
    id: t.id,
    name: t.name,
  }));

  const balances: PushimetBalanceRowDto[] = balancesRaw.map((b) => ({
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
  }));

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Pushimet</h1>
        <p className="max-w-3xl text-sm leading-relaxed text-muted-foreground">
          Rrjedhë operative për kërkesat, miratimet, balancat dhe lidhjen me payroll dhe dokumentet. Të dhënat janë të izoluara
          sipas kompanisë aktive.
        </p>
      </header>

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
  );
}
