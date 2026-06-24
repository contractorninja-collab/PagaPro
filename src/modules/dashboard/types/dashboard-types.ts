import type {
  ContractKind,
  DocumentCategory,
  DocumentGenerationArtifactKind,
  EmploymentStatus,
  EmploymentType,
  LeaveRequestStatus,
  LeaveType,
  PayrollPeriodStatus,
} from "@prisma/client";

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
  contractId: string;
  employeeId: string;
  employeeName: string;
  jobTitle: string | null;
  contractKind: ContractKind;
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

export interface DocumentCategoryCount {
  category: DocumentCategory;
  count: number;
}

export interface RecentDocumentRow {
  id: string;
  title: string;
  category: DocumentCategory;
  kind: DocumentGenerationArtifactKind;
  createdAtIso: string;
  employeeId: string | null;
  employeeName: string | null;
  templateName: string;
}

export interface EmployeeDistributionSlice {
  byStatus: Partial<Record<EmploymentStatus, number>>;
  byEmploymentType: Partial<Record<EmploymentType, number>>;
  byDepartment: Array<{ departmentId: string | null; departmentName: string; count: number }>;
}

export type OperationalAlertSeverity = "info" | "warning" | "critical";

export interface OperationalAlert {
  id: string;
  severity: OperationalAlertSeverity;
  title: string;
  detail?: string;
  href?: string;
}

export interface DashboardOperationalPayload {
  filters: DashboardFilters;
  summary: DashboardSummaryCards;
  payroll: DashboardPayrollSlice;
  contractExpiries: ContractExpiryRow[];
  leavePending: LeavePendingRow[];
  leaveToday: LeaveTodayCounts;
  timeline: TimelineEntryDto[];
  documentsThisMonthByCategory: DocumentCategoryCount[];
  recentDocuments: RecentDocumentRow[];
  distribution: EmployeeDistributionSlice;
  alerts: OperationalAlert[];
}
