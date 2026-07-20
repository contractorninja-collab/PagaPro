import type { LeaveRequest } from "@prisma/client";
import { computeWorkingDaysInRange, utcDateOnly } from "@/modules/leaves/engine/working-days";
import { getMergedHolidayIsoSetForUtcRange } from "@/modules/leaves/services/leave-working-time-service";
import { classifyLeaveForPayrollHours } from "@/modules/leaves/payroll/leave-payroll-classifier";
import {
  LEAVE_ENGINE_RULE_VERSION_V2,
  resolveLeaveEngineRuleVersion,
} from "@/modules/leaves/constants/rule-versions";

export type LeavePayrollSlice = Pick<
  LeaveRequest,
  | "id"
  | "type"
  | "startDate"
  | "endDate"
  | "isPaid"
  | "affectsPayroll"
  | "subtype"
  | "interruptedByLeaveRequestId"
  | "metricsRuleVersion"
>;

/** Version-aware leave hours for a payroll month window (same rules as each request's metrics). */
export async function approximateLeaveHoursForPayrollMonth(params: {
  companyId: string;
  requests: LeavePayrollSlice[];
  monthStart: Date;
  monthEnd: Date;
  dailyHours: number;
}): Promise<{ paidLeaveHours: number; sickLeaveHours: number; unpaidLeaveHours: number }> {
  const { companyId, requests, monthStart, monthEnd, dailyHours } = params;

  const ms = utcDateOnly(monthStart);
  const me = utcDateOnly(monthEnd);
  const rangePadStart = new Date(Date.UTC(ms.getUTCFullYear(), ms.getUTCMonth(), ms.getUTCDate(), 0, 0, 0, 0));
  const rangePadEnd = new Date(Date.UTC(me.getUTCFullYear(), me.getUTCMonth(), me.getUTCDate(), 23, 59, 59, 999));

  const holidaySet = await getMergedHolidayIsoSetForUtcRange(companyId, rangePadStart, rangePadEnd);

  let paid = 0;
  let sick = 0;
  let unpaid = 0;

  const safeDaily = Number.isFinite(dailyHours) && dailyHours > 0 ? dailyHours : 8;

  const hoursInRange = (request: LeavePayrollSlice, start: Date, end: Date): number => {
    const fixedWeekdayRule =
      resolveLeaveEngineRuleVersion(request.metricsRuleVersion) === LEAVE_ENGINE_RULE_VERSION_V2;
    const hoursPerDay = fixedWeekdayRule ? 8 : safeDaily;
    const { workingDays } = computeWorkingDaysInRange(start, end, holidaySet, hoursPerDay, {
      excludeWeekdayHolidays: !fixedWeekdayRule,
    });
    return workingDays * hoursPerDay;
  };

  const byId = new Map(requests.map((r) => [r.id, r] as const));

  for (const r of requests) {
    if (!r.affectsPayroll) continue;

    const rs = r.startDate > monthStart ? r.startDate : monthStart;
    const re = r.endDate < monthEnd ? r.endDate : monthEnd;
    if (rs > re) continue;

    const hrs = hoursInRange(r, rs, re);

    const bucket = classifyLeaveForPayrollHours({
      type: r.type,
      subtype: r.subtype ?? null,
      isPaid: r.isPaid,
    });
    if (bucket === "sick") sick += hrs;
    else if (bucket === "unpaid") unpaid += hrs;
    else paid += hrs;
  }

  // Art 34.2 — overlapping days count as sick (already in sick bucket); remove duplicate paid annual slice.
  for (const r of requests) {
    if (!r.affectsPayroll) continue;
    if (r.type !== "PUSHIM_VJETOR" || !r.interruptedByLeaveRequestId) continue;

    const sickReq = byId.get(r.interruptedByLeaveRequestId);
    if (!sickReq || sickReq.type !== "PUSHIM_MJEKESOR" || !sickReq.affectsPayroll) continue;

    let os = r.startDate;
    if (sickReq.startDate > os) os = sickReq.startDate;
    if (monthStart > os) os = monthStart;

    let oe = r.endDate;
    if (sickReq.endDate < oe) oe = sickReq.endDate;
    if (monthEnd < oe) oe = monthEnd;

    if (os > oe) continue;

    // Remove exactly the hours contributed by the annual request's own frozen rule.
    const overlapHrs = hoursInRange(r, os, oe);
    paid = Math.max(0, paid - overlapHrs);
  }

  return { paidLeaveHours: paid, sickLeaveHours: sick, unpaidLeaveHours: unpaid };
}
