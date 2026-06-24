"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { CompanyHolidayCategory } from "@prisma/client";
import type { CompanyHolidayDto } from "@/modules/payroll/services/company-holiday-service";
import {
  createCompanyHoliday,
  deleteCompanyHoliday,
  listCompanyHolidaysDto,
  seedKosovoOfficialFixedHolidaysForYear,
  setCompanyHolidayActive,
  updateCompanyHoliday,
} from "@/modules/payroll/services/company-holiday-service";
import { resolveActiveCompanyId } from "@/server/company-scope";

const categorySchema = z.enum(["KOSOVO_OFFICIAL_FIXED", "KOSOVO_OFFICIAL_MOVABLE", "COMPANY_CUSTOM"]);

const yearSchema = z.number().int().min(2000).max(2100);

async function companyIdOrError(): Promise<{ ok: true; companyId: string } | { ok: false; error: string }> {
  const id = await resolveActiveCompanyId();
  return id ? { ok: true, companyId: id } : { ok: false, error: "Nuk ka kompani aktive." };
}

export async function loadCompanyHolidaysAction(
  rawYear: unknown,
): Promise<{ ok: true; holidays: CompanyHolidayDto[] } | { ok: false; error: string }> {
  const company = await companyIdOrError();
  if (!company.ok) return company;

  const yearParsed = yearSchema.safeParse(rawYear);
  if (!yearParsed.success) return { ok: false, error: "Viti jo valid." };

  const holidays = await listCompanyHolidaysDto(company.companyId, yearParsed.data);
  return { ok: true, holidays };
}

export async function seedKosovoOfficialFixedHolidaysAction(
  rawYear: unknown,
): Promise<{ ok: true; upserted: number } | { ok: false; error: string }> {
  const company = await companyIdOrError();
  if (!company.ok) return company;

  const yearParsed = yearSchema.safeParse(rawYear);
  if (!yearParsed.success) return { ok: false, error: "Viti jo valid." };

  const { upserted } = await seedKosovoOfficialFixedHolidaysForYear(company.companyId, yearParsed.data);
  revalidatePath("/konfigurime");
  return { ok: true, upserted };
}

const createSchema = z.object({
  calendarYear: yearSchema,
  observedOnIso: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  name: z.string().trim().min(1).max(256),
  category: categorySchema,
  notes: z.string().trim().max(2000).optional().nullable(),
});

export async function createCompanyHolidayAction(
  raw: unknown,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const company = await companyIdOrError();
  if (!company.ok) return company;

  const parsed = createSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Të dhënat e festës nuk janë valide." };

  const row = await createCompanyHoliday({
    companyId: company.companyId,
    calendarYear: parsed.data.calendarYear,
    observedOnIso: parsed.data.observedOnIso,
    name: parsed.data.name,
    category: parsed.data.category as CompanyHolidayCategory,
    notes: parsed.data.notes,
  });
  if (!row) return { ok: false, error: "Nuk u ruajt (data e dyfishtë ose gabim)." };

  revalidatePath("/konfigurime");
  return { ok: true };
}

const updateSchema = z.object({
  id: z.string().min(1),
  observedOnIso: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  name: z.string().trim().min(1).max(256).optional(),
  category: categorySchema.optional(),
  notes: z.string().trim().max(2000).optional().nullable(),
});

export async function updateCompanyHolidayAction(
  raw: unknown,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const company = await companyIdOrError();
  if (!company.ok) return company;

  const parsed = updateSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Të dhënat e festës nuk janë valide." };

  const row = await updateCompanyHoliday({
    companyId: company.companyId,
    id: parsed.data.id,
    observedOnIso: parsed.data.observedOnIso,
    name: parsed.data.name,
    category: parsed.data.category as CompanyHolidayCategory | undefined,
    notes: parsed.data.notes,
  });
  if (!row) return { ok: false, error: "Përditësimi dështoi." };

  revalidatePath("/konfigurime");
  return { ok: true };
}

const idSchema = z.object({ id: z.string().min(1) });

export async function deleteCompanyHolidayAction(
  raw: unknown,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const company = await companyIdOrError();
  if (!company.ok) return company;

  const parsed = idSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "ID jo valid." };

  const ok = await deleteCompanyHoliday(company.companyId, parsed.data.id);
  if (!ok) return { ok: false, error: "Festa nuk u gjet." };

  revalidatePath("/konfigurime");
  return { ok: true };
}

const toggleSchema = z.object({
  id: z.string().min(1),
  isActive: z.boolean(),
});

export async function toggleCompanyHolidayActiveAction(
  raw: unknown,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const company = await companyIdOrError();
  if (!company.ok) return company;

  const parsed = toggleSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Kërkesë jo valide." };

  const ok = await setCompanyHolidayActive({
    companyId: company.companyId,
    id: parsed.data.id,
    isActive: parsed.data.isActive,
  });
  if (!ok) return { ok: false, error: "Festa nuk u gjet." };

  revalidatePath("/konfigurime");
  return { ok: true };
}
