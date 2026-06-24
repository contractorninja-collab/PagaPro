import type { LeaveSubtype, LeaveType } from "@prisma/client";

export type PayrollLeaveHoursBucket = "paid" | "sick" | "unpaid";

export function classifyLeaveForPayrollHours(params: {
  type: LeaveType;
  subtype?: LeaveSubtype | null;
  isPaid: boolean;
}): PayrollLeaveHoursBucket {
  if (params.type === "PUSHIM_MJEKESOR") return "sick";
  if (!params.isPaid || params.type === "PUSHIM_PA_PAGESE") return "unpaid";

  const st = params.subtype ?? "NONE";
  if (st === "ATERSI_PA_PAGESE_JAVE_2" || st === "LEHONI_FAZA_FUNDIT_PA_PAGESE") return "unpaid";

  return "paid";
}
