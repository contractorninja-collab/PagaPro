import type { CompanyHoliday, CompanyHolidayCategory } from "@prisma/client";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  isoDateUtc,
  KOSOVO_OFFICIAL_FIXED_HOLIDAY_DEFINITIONS,
} from "@/modules/payroll/calendar/kosovo-public-holidays";

export interface CompanyHolidayDto {
  id: string;
  calendarYear: number;
  observedOn: string;
  name: string;
  category: CompanyHolidayCategory;
  isActive: boolean;
  sourceCode: string | null;
  notes: string | null;
}

function utcDateOnly(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month - 1, day, 12, 0, 0, 0));
}

export function observedOnFromIsoDate(iso: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return null;
  return utcDateOnly(y, m, d);
}

export function formatCompanyHolidayObservedIso(row: CompanyHoliday): string {
  const y = row.observedOn.getUTCFullYear();
  const mo = row.observedOn.getUTCMonth() + 1;
  const d = row.observedOn.getUTCDate();
  return isoDateUtc(y, mo, d);
}

function toDto(row: CompanyHoliday): CompanyHolidayDto {
  return {
    id: row.id,
    calendarYear: row.calendarYear,
    observedOn: formatCompanyHolidayObservedIso(row),
    name: row.name,
    category: row.category,
    isActive: row.isActive,
    sourceCode: row.sourceCode ?? null,
    notes: row.notes ?? null,
  };
}

export async function listCompanyHolidaysDto(
  companyId: string,
  calendarYear: number,
): Promise<CompanyHolidayDto[]> {
  try {
    const rows = await prisma.companyHoliday.findMany({
      where: { companyId, calendarYear },
      orderBy: [{ observedOn: "asc" }, { name: "asc" }],
    });
    return rows.map(toDto);
  } catch (e) {
    if (
      e instanceof Prisma.PrismaClientKnownRequestError &&
      (e.code === "P2021" || e.code === "P2022")
    ) {
      console.warn(
        "[pagapro] `company_holidays` out of sync — holiday UI/working-days extras disabled until DB matches schema (`npx prisma migrate deploy`).",
      );
      return [];
    }
    throw e;
  }
}

/**
 * If the company has no holiday rows for `calendarYear`, inserts Kosovo official FIXED holidays.
 * Idempotent per year — skips entirely when any row exists for that year (including custom-only calendars).
 */
export async function maybeSeedKosovoOfficialFixedHolidaysForYearIfEmpty(
  companyId: string,
  calendarYear: number,
): Promise<{ seeded: boolean; upserted: number }> {
  try {
    const count = await prisma.companyHoliday.count({
      where: { companyId, calendarYear },
    });
    if (count > 0) {
      return { seeded: false, upserted: 0 };
    }
    const { upserted } = await seedKosovoOfficialFixedHolidaysForYear(companyId, calendarYear);
    return { seeded: true, upserted };
  } catch (e) {
    if (
      e instanceof Prisma.PrismaClientKnownRequestError &&
      (e.code === "P2021" || e.code === "P2022")
    ) {
      console.warn(
        "[pagapro] Skipping Kosovo holiday seed — `company_holidays` out of sync (`npx prisma migrate deploy`).",
      );
      return { seeded: false, upserted: 0 };
    }
    throw e;
  }
}

/** Uses UTC calendar year (`new Date().getUTCFullYear()`). */
export async function maybeSeedKosovoOfficialFixedHolidaysForCurrentUtcYearIfEmpty(
  companyId: string,
): Promise<{ seeded: boolean; upserted: number }> {
  return maybeSeedKosovoOfficialFixedHolidaysForYearIfEmpty(companyId, new Date().getUTCFullYear());
}

export async function seedKosovoOfficialFixedHolidaysForYear(
  companyId: string,
  calendarYear: number,
): Promise<{ upserted: number }> {
  let upserted = 0;
  for (const def of KOSOVO_OFFICIAL_FIXED_HOLIDAY_DEFINITIONS) {
    const observedOn = utcDateOnly(calendarYear, def.month, def.day);
    await prisma.companyHoliday.upsert({
      where: {
        companyId_calendarYear_observedOn: {
          companyId,
          calendarYear,
          observedOn,
        },
      },
      create: {
        companyId,
        calendarYear,
        observedOn,
        name: def.defaultNameSq,
        category: "KOSOVO_OFFICIAL_FIXED",
        isActive: true,
        sourceCode: def.sourceCode,
      },
      update: {
        name: def.defaultNameSq,
        category: "KOSOVO_OFFICIAL_FIXED",
        sourceCode: def.sourceCode,
      },
    });
    upserted++;
  }
  return { upserted };
}

export async function createCompanyHoliday(params: {
  companyId: string;
  calendarYear: number;
  observedOnIso: string;
  name: string;
  category: CompanyHolidayCategory;
  notes?: string | null;
}): Promise<CompanyHolidayDto | null> {
  const observedOn = observedOnFromIsoDate(params.observedOnIso);
  if (!observedOn) return null;

  try {
    const row = await prisma.companyHoliday.create({
      data: {
        companyId: params.companyId,
        calendarYear: params.calendarYear,
        observedOn,
        name: params.name.trim(),
        category: params.category,
        isActive: true,
        notes: params.notes?.trim() || null,
      },
    });
    return toDto(row);
  } catch {
    return null;
  }
}

export async function updateCompanyHoliday(params: {
  companyId: string;
  id: string;
  observedOnIso?: string;
  name?: string;
  category?: CompanyHolidayCategory;
  notes?: string | null;
}): Promise<CompanyHolidayDto | null> {
  const existing = await prisma.companyHoliday.findFirst({
    where: { id: params.id, companyId: params.companyId },
  });
  if (!existing) return null;

  let observedOn = existing.observedOn;
  if (params.observedOnIso != null) {
    const parsed = observedOnFromIsoDate(params.observedOnIso);
    if (!parsed) return null;
    observedOn = parsed;
  }

  try {
    const row = await prisma.companyHoliday.update({
      where: { id: params.id },
      data: {
        observedOn,
        ...(params.name != null ? { name: params.name.trim() } : {}),
        ...(params.category != null ? { category: params.category } : {}),
        ...(params.notes !== undefined ? { notes: params.notes?.trim() || null } : {}),
      },
    });
    return toDto(row);
  } catch {
    return null;
  }
}

export async function setCompanyHolidayActive(params: {
  companyId: string;
  id: string;
  isActive: boolean;
}): Promise<boolean> {
  const res = await prisma.companyHoliday.updateMany({
    where: { id: params.id, companyId: params.companyId },
    data: { isActive: params.isActive },
  });
  return res.count > 0;
}

export async function deleteCompanyHoliday(companyId: string, id: string): Promise<boolean> {
  const res = await prisma.companyHoliday.deleteMany({
    where: { id, companyId },
  });
  return res.count > 0;
}
