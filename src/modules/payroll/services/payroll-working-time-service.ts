import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  expectedRegularHoursFromWorkingDays,
  splitPayrollMonthWorkingDays,
} from "@/modules/payroll/services/payroll-calendar-service";

export function parseIsoDateJsonList(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((x): x is string => typeof x === "string" && /^\d{4}-\d{2}-\d{2}$/.test(x));
}

function observedIsoFromRow(row: { observedOn: Date }): string {
  const y = row.observedOn.getUTCFullYear();
  const m = row.observedOn.getUTCMonth() + 1;
  const d = row.observedOn.getUTCDate();
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

async function resolveMergedHolidayIsoDatesForMonth(
  companyId: string,
  year: number,
  month: number,
  payrollExtraHolidayDates: unknown,
  payrollExcludedHolidayDates: unknown,
): Promise<string[]> {
  const monthStart = new Date(Date.UTC(year, month - 1, 1, 12, 0, 0, 0));
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const monthEnd = new Date(Date.UTC(year, month - 1, lastDay, 12, 0, 0, 0));

  let rows: { observedOn: Date }[] = [];
  try {
    rows = await prisma.companyHoliday.findMany({
      where: {
        companyId,
        calendarYear: year,
        isActive: true,
        observedOn: { gte: monthStart, lte: monthEnd },
      },
      select: { observedOn: true },
    });
  } catch (e) {
    if (
      e instanceof Prisma.PrismaClientKnownRequestError &&
      (e.code === "P2021" || e.code === "P2022")
    ) {
      console.warn(
        "[pagapro] `company_holidays` out of sync — using legacy JSON holiday overrides only until migrations run.",
      );
      rows = [];
    } else {
      throw e;
    }
  }

  const extras = parseIsoDateJsonList(payrollExtraHolidayDates);
  const excluded = parseIsoDateJsonList(payrollExcludedHolidayDates);

  const merged = new Set<string>();
  for (const r of rows) merged.add(observedIsoFromRow(r));
  for (const iso of extras) merged.add(iso);
  for (const iso of excluded) merged.delete(iso);
  return [...merged].sort();
}

export async function resolvePayrollMonthWorkingTime(companyId: string, year: number, month: number) {
  const settings = await prisma.payrollSettings.findUnique({ where: { companyId } });
  if (!settings) return null;

  const holidayIsoDates = await resolveMergedHolidayIsoDatesForMonth(
    companyId,
    year,
    month,
    settings.payrollExtraHolidayDates,
    settings.payrollExcludedHolidayDates,
  );

  const split = splitPayrollMonthWorkingDays(year, month, holidayIsoDates);
  const hoursPerDay = settings.hoursPerWorkingDay.toNumber();
  const expectedRegularHours = expectedRegularHoursFromWorkingDays(
    split.workingDaysMondayFridayExcludingHolidays,
    hoursPerDay,
  );

  return {
    expectedWorkingDays: split.workingDaysMondayFridayExcludingHolidays,
    expectedRegularHours,
    hoursPerWorkingDay: settings.hoursPerWorkingDay.toString(),
    weekdayPublicHolidayDates: split.weekdayPublicHolidayDates,
    overtimeWeeklyThresholdHours: settings.overtimeWeeklyThresholdHours.toString(),
    overtimeWarningWeeklyHours: settings.overtimeWeeklyCapHours.toString(),
    standardWeeklyHours: settings.standardWeeklyHours.toString(),
    nightWorkPeriodDescription: settings.nightWorkPeriodDescription,
  };
}
