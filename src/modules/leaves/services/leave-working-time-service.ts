import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { isoDateUtc } from "@/modules/payroll/calendar/kosovo-public-holidays";
import { parseIsoDateJsonList } from "@/modules/payroll/services/payroll-working-time-service";

function observedIsoFromRow(row: { observedOn: Date }): string {
  const y = row.observedOn.getUTCFullYear();
  const m = row.observedOn.getUTCMonth() + 1;
  const day = row.observedOn.getUTCDate();
  return isoDateUtc(y, m, day);
}

/** Merged holiday ISO set for UTC-inclusive range (company rows + payroll JSON extras − exclusions). */
export async function getMergedHolidayIsoSetForUtcRange(
  companyId: string,
  rangeStart: Date,
  rangeEnd: Date,
): Promise<Set<string>> {
  const settings = await prisma.payrollSettings.findUnique({ where: { companyId } });
  const extras = parseIsoDateJsonList(settings?.payrollExtraHolidayDates);
  const excluded = parseIsoDateJsonList(settings?.payrollExcludedHolidayDates);

  let rows: { observedOn: Date }[] = [];
  try {
    rows = await prisma.companyHoliday.findMany({
      where: {
        companyId,
        isActive: true,
        observedOn: { gte: rangeStart, lte: rangeEnd },
      },
      select: { observedOn: true },
    });
  } catch (e) {
    if (
      e instanceof Prisma.PrismaClientKnownRequestError &&
      (e.code === "P2021" || e.code === "P2022")
    ) {
      rows = [];
    } else {
      throw e;
    }
  }

  const merged = new Set<string>();
  for (const r of rows) merged.add(observedIsoFromRow(r));
  for (const iso of extras) merged.add(iso);
  for (const iso of excluded) merged.delete(iso);
  return merged;
}

export async function getHoursPerWorkingDayForCompany(companyId: string): Promise<number> {
  const settings = await prisma.payrollSettings.findUnique({ where: { companyId } });
  return settings?.hoursPerWorkingDay?.toNumber?.() ?? 8;
}
