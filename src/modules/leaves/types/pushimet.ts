import type { LeaveRequestStatus, LeaveSubtype, LeaveType } from "@prisma/client";

export type PushimetLeaveRowDto = {
  id: string;
  employeeId: string;
  employeeName: string;
  departmentName: string | null;
  type: LeaveType;
  subtype: LeaveSubtype;
  interruptedByLeaveRequestId: string | null;
  status: LeaveRequestStatus;
  startDateIso: string;
  endDateIso: string;
  totalDays: string | null;
  workingDays: string | null;
  totalHours: string | null;
  isPaid: boolean;
  affectsPayroll: boolean;
  reason: string | null;
  rejectionReason: string | null;
  decidedAtIso: string | null;
  decidedByLabel: string | null;
};

export type PushimetCalendarChipDto = Pick<
  PushimetLeaveRowDto,
  "id" | "employeeId" | "employeeName" | "startDateIso" | "endDateIso" | "status" | "type"
>;

export type PushimetBalanceRowDto = {
  id: string;
  employeeId: string;
  employeeName: string;
  departmentName: string | null;
  leaveType: LeaveType;
  year: number;
  yearlyQuota: string;
  accruedDays: string;
  carryOverDays: string;
  usedDays: string;
  pendingDays: string;
  remainingDays: string;
  /** Projected available balance by year-end (carry + accrual-to-year-end − used). Annual only. */
  projectedYearEndDays: string | null;
  /** ISO date when carried-in days expire (June 30), if any carry is active. */
  carryExpiresIso: string | null;
  /** Entitlement breakdown for annual leave: base + tenure + special/hazardous. */
  entitlementBreakdown: { base: number; tenure: number; special: number } | null;
  /**
   * Kosovo-law entitlement warnings the engine already composed in Albanian and
   * persisted on the balance — first-year entitlement, insufficient balance,
   * carry-over about to expire, the Art 37.6 ten-day block, annual/medical
   * overlap. They were written and then read by nobody.
   */
  warnings: string[];
};

export type PushimetEmployeeOptionDto = {
  id: string;
  label: string;
  eligibleYears: number[];
};
export type PushimetDepartmentOptionDto = { id: string; name: string };
export type PushimetTemplateOptionDto = { id: string; name: string };
