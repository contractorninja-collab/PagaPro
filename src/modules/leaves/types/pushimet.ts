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
  usedDays: string;
  remainingDays: string;
  carryOverDays: string;
};

export type PushimetEmployeeOptionDto = { id: string; label: string };
export type PushimetDepartmentOptionDto = { id: string; name: string };
export type PushimetTemplateOptionDto = { id: string; name: string };
