import type {
  ContractTermType,
  EmploymentStatus,
  EmploymentType,
  LeaveRequestStatus,
  LeaveType,
  PayrollPeriodStatus,
} from "@prisma/client";
import type { DashboardCostMetrics } from "../services/dashboard-metrics-service";

/** URL/query-driven dashboard scope (multi-company via cookie elsewhere). */
export interface DashboardFilters {
  year: number;
  month: number;
  /** When set, restricts widgets that support employee scoping. */
  departmentId: string | null;
}

export interface DashboardSummaryCards {
  activeEmployees: number;
  contractsExpiringWithin30Days: number;
  payrollsInDraft: number;
  leaveRequestsPending: number;
  documentsGeneratedThisMonth: number;
  employeesTerminatedThisMonth: number;
}

export interface DashboardPayrollSlice {
  payrollId: string | null;
  year: number;
  month: number;
  status: PayrollPeriodStatus | null;
  employeeCount: number;
  totals: {
    grossSalary: string;
    netPay: string;
    employerTotalCost: string;
  };
  reviewedAtIso: string | null;
  approvedAtIso: string | null;
  lockedAtIso: string | null;
}

export interface ContractExpiryRow {
  employeeId: string;
  employeeName: string;
  jobTitle: string | null;
  /** The employee's contract term — the thing that actually expires. */
  contractTerm: ContractTermType;
  endDateIso: string;
  daysRemaining: number;
  urgency: "7" | "14" | "30";
}

export interface LeavePendingRow {
  id: string;
  employeeId: string;
  employeeName: string;
  type: LeaveType;
  status: LeaveRequestStatus;
  startDateIso: string;
  endDateIso: string;
}

export interface LeaveTodayCounts {
  approved: number;
  rejected: number;
}

export interface TimelineEntryDto {
  id: string;
  source: "domain" | "employee_timeline" | "audit" | "document_timeline";
  occurredAtIso: string;
  title: string;
  subtitle?: string;
  actorLabel: string | null;
}

export interface EmployeeDistributionSlice {
  byStatus: Partial<Record<EmploymentStatus, number>>;
  byEmploymentType: Partial<Record<EmploymentType, number>>;
  byDepartment: Array<{ departmentId: string | null; departmentName: string; count: number }>;
}

export interface DocumentsMissingEmployeeRef {
  id: string;
  fullName: string;
}

export type OperationalAlertSeverity = "info" | "warning" | "critical";

export interface OperationalAlert {
  id: string;
  severity: OperationalAlertSeverity;
  title: string;
  detail?: string;
  href?: string;
  actionLabel?: string;
}

/** Who is out, who is in, and what's next — the "is today normal?" slice. */
export interface DashboardTodaySlice {
  onLeave: Array<{
    leaveId: string;
    employeeId: string;
    employeeName: string;
    typeLabel: string;
    endDateIso: string;
  }>;
  onLeaveTotal: number;
  /** Null when the badge time clock is not part of the company's plan. */
  timeClock: {
    enabled: true;
    clockedIn: number;
    punchesToday: number;
    needsReview: number;
  } | null;
  nextHoliday: { dateIso: string; name: string } | null;
}

/** Null-ish when the hourly contractor payroll is not enabled for the company. */
export interface DashboardContractorSlice {
  enabled: boolean;
  latest: {
    id: string;
    year: number;
    month: number;
    status: "DRAFT" | "LOCKED" | "ARCHIVED";
    entryCount: number;
    totalGross: string;
  } | null;
}

/** Joiners and leavers per month — the headcount story behind the cost story. */
export interface WorkforceMovementPointDto {
  key: string;
  label: string;
  joiners: number;
  leavers: number;
  net: number;
}

export interface DashboardOperationalPayload {
  filters: DashboardFilters;
  summary: DashboardSummaryCards;
  payroll: DashboardPayrollSlice;
  contractExpiries: ContractExpiryRow[];
  leavePending: LeavePendingRow[];
  leaveToday: LeaveTodayCounts;
  timeline: TimelineEntryDto[];
  distribution: EmployeeDistributionSlice;
  alerts: OperationalAlert[];
  today: DashboardTodaySlice;
  contractor: DashboardContractorSlice;
  movement: WorkforceMovementPointDto[];
  /** Cost trend plus the month-over-month / year-to-date comparisons. */
  costMetrics: DashboardCostMetrics;
}
