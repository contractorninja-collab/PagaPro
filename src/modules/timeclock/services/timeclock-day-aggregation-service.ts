import { prisma } from "@/lib/prisma";
import { classifyDay } from "@/modules/timeclock/calculation/classify-day";
import type { ClassifiedDay, ClassifierPunch, ClassifierRules } from "@/modules/timeclock/calculation/types";
import { zonedParts } from "@/modules/timeclock/calculation/zoned-time";
import { getMergedHolidayIsoSetForUtcRange } from "@/modules/leaves/services/leave-working-time-service";

/**
 * Punch → TimeClockDay pipeline. Recomputed idempotently from the immutable punch
 * log: re-running after a correction (a void, a manual punch) always converges on
 * the same derived rows, so callers can invoke it freely before reading hours.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

export type RecomputeDaysOutcome =
  | { ok: true; days: ClassifiedDay[] }
  | { ok: false; code: "COMPANY_NOT_FOUND" | "ERROR" };

async function buildRules(companyId: string, rangeStart: Date, rangeEnd: Date): Promise<ClassifierRules | null> {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { timezone: true },
  });
  if (!company) return null;

  const settings = await prisma.payrollSettings.findUnique({
    where: { companyId },
    select: { hoursPerWorkingDay: true, nightStartHour: true, nightEndHour: true },
  });

  const hoursPerDay = settings ? Number(settings.hoursPerWorkingDay) : 8;
  const holidayIsoDates = await getMergedHolidayIsoSetForUtcRange(companyId, rangeStart, rangeEnd);

  return {
    dailyRegularMinutes: Math.round(hoursPerDay * 60),
    nightStartHour: settings?.nightStartHour ?? 22,
    nightEndHour: settings?.nightEndHour ?? 6,
    holidayIsoDates,
    timeZone: company.timezone,
  };
}

/**
 * Groups a sorted punch stream into local work days. An OUT is attributed to the
 * day of the IN it closes — an overnight shift belongs to the day it started —
 * while a stray OUT (nothing open) lands on its own local day for review.
 */
function groupPunchesByWorkDay(
  punches: readonly { occurredAt: Date; direction: "IN" | "OUT" }[],
  timeZone: string,
): Map<string, ClassifierPunch[]> {
  const groups = new Map<string, ClassifierPunch[]>();
  let openInDay: string | null = null;

  const push = (day: string, punch: ClassifierPunch) => {
    const list = groups.get(day);
    if (list) list.push(punch);
    else groups.set(day, [punch]);
  };

  for (const punch of punches) {
    const day = zonedParts(punch.occurredAt, timeZone).isoDate;
    const classifierPunch: ClassifierPunch = { occurredAt: punch.occurredAt, direction: punch.direction };
    if (punch.direction === "IN") {
      push(day, classifierPunch);
      openInDay = day;
    } else if (openInDay !== null) {
      push(openInDay, classifierPunch);
      openInDay = null;
    } else {
      push(day, classifierPunch);
    }
  }

  return groups;
}

function utcDateFromIso(isoDate: string): Date {
  return new Date(`${isoDate}T00:00:00.000Z`);
}

/**
 * Recomputes every TimeClockDay for one employee across a UTC range: loads the
 * non-voided punches (padded a day each side so overnight shifts keep their
 * spillover), classifies each local day with the company's real rules, upserts
 * the derived rows and removes rows whose punches have since been voided away.
 */
export async function recomputeTimeClockDaysForRange(params: {
  companyId: string;
  employeeId: string;
  rangeStart: Date;
  rangeEnd: Date;
}): Promise<RecomputeDaysOutcome> {
  const { companyId, employeeId, rangeStart, rangeEnd } = params;
  try {
    const paddedStart = new Date(rangeStart.getTime() - DAY_MS);
    const paddedEnd = new Date(rangeEnd.getTime() + DAY_MS);

    const rules = await buildRules(companyId, paddedStart, paddedEnd);
    if (!rules) return { ok: false, code: "COMPANY_NOT_FOUND" };

    const punches = await prisma.timeClockPunch.findMany({
      where: {
        companyId,
        employeeId,
        voidedAt: null,
        occurredAt: { gte: paddedStart, lte: paddedEnd },
      },
      orderBy: { occurredAt: "asc" },
      select: { occurredAt: true, direction: true },
    });

    const startDayIso = zonedParts(rangeStart, rules.timeZone).isoDate;
    const endDayIso = zonedParts(rangeEnd, rules.timeZone).isoDate;

    const groups = groupPunchesByWorkDay(punches, rules.timeZone);

    const days: ClassifiedDay[] = [];
    for (const [dayIso, dayPunches] of groups) {
      if (dayIso < startDayIso || dayIso > endDayIso) continue;
      const classified = classifyDay(dayPunches, rules);
      // classifyDay derives the date from the first interval; a review-only day
      // keeps the grouping key so the row lands where the punches sit.
      days.push({ ...classified, workDateIso: classified.workDateIso || dayIso });
    }

    const ruleSnapshot = {
      dailyRegularMinutes: rules.dailyRegularMinutes,
      nightStartHour: rules.nightStartHour,
      nightEndHour: rules.nightEndHour,
      timeZone: rules.timeZone,
    };

    await prisma.$transaction([
      ...days.map((day) =>
        prisma.timeClockDay.upsert({
          where: { employeeId_workDate: { employeeId, workDate: utcDateFromIso(day.workDateIso) } },
          create: {
            companyId,
            employeeId,
            workDate: utcDateFromIso(day.workDateIso),
            status: day.status,
            workedMinutes: day.workedMinutes,
            regularMinutes: day.regularMinutes,
            overtimeMinutes: day.overtimeMinutes,
            weekendMinutes: day.weekendMinutes,
            holidayMinutes: day.holidayMinutes,
            nightMinutes: day.nightMinutes,
            nightStackMinutes: day.nightStackMinutes,
            firstInAt: day.firstInAt,
            lastOutAt: day.lastOutAt,
            reviewReason: day.reviewReason,
            ruleSnapshot,
            computedAt: new Date(),
          },
          update: {
            status: day.status,
            workedMinutes: day.workedMinutes,
            regularMinutes: day.regularMinutes,
            overtimeMinutes: day.overtimeMinutes,
            weekendMinutes: day.weekendMinutes,
            holidayMinutes: day.holidayMinutes,
            nightMinutes: day.nightMinutes,
            nightStackMinutes: day.nightStackMinutes,
            firstInAt: day.firstInAt,
            lastOutAt: day.lastOutAt,
            reviewReason: day.reviewReason,
            ruleSnapshot,
            computedAt: new Date(),
          },
        }),
      ),
      prisma.timeClockDay.deleteMany({
        where: {
          companyId,
          employeeId,
          workDate: { gte: utcDateFromIso(startDayIso), lte: utcDateFromIso(endDayIso) },
          ...(days.length > 0
            ? { NOT: { workDate: { in: days.map((d) => utcDateFromIso(d.workDateIso)) } } }
            : {}),
        },
      }),
    ]);

    return { ok: true, days };
  } catch (error) {
    console.error("recomputeTimeClockDaysForRange failed", error);
    return { ok: false, code: "ERROR" };
  }
}
