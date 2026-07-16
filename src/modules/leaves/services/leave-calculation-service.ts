import { countCalendarDaysInclusiveUtc, computeWorkingDaysInRange, utcDateOnly } from "@/modules/leaves/engine/working-days";
import {
  getHoursPerWorkingDayForCompany,
  getMergedHolidayIsoSetForUtcRange,
} from "@/modules/leaves/services/leave-working-time-service";
import {
  LEAVE_ENGINE_RULE_VERSION,
  LEAVE_ENGINE_RULE_VERSION_V2,
  resolveLeaveEngineRuleVersion,
  type LeaveEngineRuleVersion,
} from "@/modules/leaves/constants/rule-versions";

export interface LeaveMetricsComputed {
  calendarDays: number;
  workingDays: number;
  totalHours: string;
  hoursPerDay: string;
  weekdayHolidayDatesInRange: string[];
}

export { countCalendarDaysInclusiveUtc } from "@/modules/leaves/engine/working-days";

export async function computeLeaveMetrics(
  companyId: string,
  startDate: Date,
  endDate: Date,
  requestedRuleVersion: string = LEAVE_ENGINE_RULE_VERSION,
): Promise<LeaveMetricsComputed> {
  const ruleVersion: LeaveEngineRuleVersion = resolveLeaveEngineRuleVersion(requestedRuleVersion);
  const fixedWeekdayRule = ruleVersion === LEAVE_ENGINE_RULE_VERSION_V2;
  const s = utcDateOnly(startDate);
  const e = utcDateOnly(endDate);
  if (e.getTime() < s.getTime()) {
    return {
      calendarDays: 0,
      workingDays: 0,
      totalHours: "0",
      hoursPerDay: "8",
      weekdayHolidayDatesInRange: [],
    };
  }

  const hoursPerDay = fixedWeekdayRule ? 8 : await getHoursPerWorkingDayForCompany(companyId);

  const rangePadStart = new Date(Date.UTC(s.getUTCFullYear(), s.getUTCMonth(), s.getUTCDate(), 0, 0, 0, 0));
  const rangePadEnd = new Date(Date.UTC(e.getUTCFullYear(), e.getUTCMonth(), e.getUTCDate(), 23, 59, 59, 999));

  const holidays = await getMergedHolidayIsoSetForUtcRange(companyId, rangePadStart, rangePadEnd);

  const { workingDays, weekdayHolidayDatesInRange, totalHours } = computeWorkingDaysInRange(
    startDate,
    endDate,
    holidays,
    hoursPerDay,
    { excludeWeekdayHolidays: !fixedWeekdayRule },
  );

  const calendarDays = countCalendarDaysInclusiveUtc(startDate, endDate);

  return {
    calendarDays,
    workingDays,
    totalHours,
    hoursPerDay: String(hoursPerDay),
    weekdayHolidayDatesInRange,
  };
}
