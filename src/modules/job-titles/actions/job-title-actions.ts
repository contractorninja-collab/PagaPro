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
import { companyContextErrorMessage, getCompanyContext } from "@/server/company-context";

const REVALIDATE_PATHS = ["/konfigurime", "/punonjesit", "/dokumentet"] as const;

function revalidateJobTitlePaths(): void {
  for (const path of REVALIDATE_PATHS) revalidatePath(path);
}

async function companyIdOrError(): Promise<
  { ok: true; companyId: string; userId: string } | { ok: false; error: string }
> {
  const result = await getCompanyContext();
  return result.ok
    ? { ok: true, companyId: result.context.companyId, userId: result.context.user.id }
    : { ok: false, error: companyContextErrorMessage(result.reason) };
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

  const res = await upsertJobTitle(company.companyId, parsed.data, company.userId);
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

  const res = await setJobTitleArchived(company.companyId, parsed.data.id, true, company.userId);
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

  const res = await setJobTitleArchived(company.companyId, parsed.data.id, false, company.userId);
  if (!res.ok) return mutationError(res.code, res.message);

  revalidateJobTitlePaths();
  return { ok: true };
}
