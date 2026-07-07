"use server";

import { revalidatePath } from "next/cache";
import {
  listJobTitlesForCompany,
  setJobTitleArchived,
  upsertJobTitle,
  type JobTitleDto,
} from "@/modules/job-titles/services/job-title-service";
import {
  jobTitleIdSchema,
  jobTitleUpsertSchema,
} from "@/modules/job-titles/validation/job-title-schemas";
import { resolveActiveCompanyId } from "@/server/company-scope";

const REVALIDATE_PATHS = ["/konfigurime", "/punonjesit", "/dokumentet"] as const;

function revalidateJobTitlePaths(): void {
  for (const path of REVALIDATE_PATHS) revalidatePath(path);
}

async function companyIdOrError(): Promise<{ ok: true; companyId: string } | { ok: false; error: string }> {
  const id = await resolveActiveCompanyId();
  return id ? { ok: true, companyId: id } : { ok: false, error: "Nuk ka kompani aktive." };
}

function mutationError(
  code: "DUPLICATE_TITLE" | "NOT_FOUND" | "DB_ERROR",
  message?: string,
): { ok: false; error: string } {
  if (code === "DUPLICATE_TITLE") {
    return { ok: false, error: "Ky titull pozite ekziston tashmë për këtë kompani." };
  }
  if (code === "NOT_FOUND") return { ok: false, error: "Pozita nuk u gjet." };
  return { ok: false, error: message ?? "Operacioni dështoi." };
}

export async function loadJobTitlesAction(): Promise<
  { ok: true; jobTitles: JobTitleDto[] } | { ok: false; error: string }
> {
  const company = await companyIdOrError();
  if (!company.ok) return company;

  const jobTitles = await listJobTitlesForCompany(company.companyId);
  return { ok: true, jobTitles };
}

export async function saveJobTitleAction(
  raw: unknown,
): Promise<{ ok: true; id: string } | { ok: false; error: string; fieldErrors?: Record<string, string[]> }> {
  const company = await companyIdOrError();
  if (!company.ok) return company;

  const parsed = jobTitleUpsertSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Ju lutem korrigjoni fushat e pozitës.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const res = await upsertJobTitle(company.companyId, parsed.data, null);
  if (!res.ok) return mutationError(res.code, res.message);

  revalidateJobTitlePaths();
  return { ok: true, id: res.id };
}

export async function archiveJobTitleAction(
  raw: unknown,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const company = await companyIdOrError();
  if (!company.ok) return company;

  const parsed = jobTitleIdSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "ID e pozitës nuk është valide." };

  const res = await setJobTitleArchived(company.companyId, parsed.data.id, true, null);
  if (!res.ok) return mutationError(res.code, res.message);

  revalidateJobTitlePaths();
  return { ok: true };
}

export async function restoreJobTitleAction(
  raw: unknown,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const company = await companyIdOrError();
  if (!company.ok) return company;

  const parsed = jobTitleIdSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "ID e pozitës nuk është valide." };

  const res = await setJobTitleArchived(company.companyId, parsed.data.id, false, null);
  if (!res.ok) return mutationError(res.code, res.message);

  revalidateJobTitlePaths();
  return { ok: true };
}
