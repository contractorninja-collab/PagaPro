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
import { can, capabilityDeniedMessage, type Capability } from "@/server/permissions";

const REVALIDATE_PATHS = ["/konfigurime", "/punonjesit", "/dokumentet"] as const;

function revalidateJobTitlePaths(): void {
  for (const path of REVALIDATE_PATHS) revalidatePath(path);
}

/**
 * `capability` is required so a new action must state whether it reads or
 * writes. Job titles are HR data: writing them is employees.write, not
 * company.settings, even though the UI sits under Konfigurimet.
 */
async function companyIdOrError(
  capability: Capability | null,
): Promise<{ ok: true; companyId: string; userId: string } | { ok: false; error: string }> {
  const result = await getCompanyContext();
  if (!result.ok) return { ok: false, error: companyContextErrorMessage(result.reason) };

  const { user, role, companyId } = result.context;
  if (capability && !can({ role, isPlatformAdmin: user.isPlatformAdmin }, capability)) {
    return { ok: false, error: capabilityDeniedMessage(capability) };
  }
  return { ok: true, companyId, userId: user.id };
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
  const company = await companyIdOrError(null);
  if (!company.ok) return company;

  const jobTitles = await listJobTitlesForCompany(company.companyId);
  return { ok: true, jobTitles };
}

export async function saveJobTitleAction(
  raw: unknown,
): Promise<{ ok: true; id: string } | { ok: false; error: string; fieldErrors?: Record<string, string[]> }> {
  const company = await companyIdOrError("employees.write");
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
  const company = await companyIdOrError("employees.write");
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
  const company = await companyIdOrError("employees.write");
  if (!company.ok) return company;

  const parsed = jobTitleIdSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "ID e pozitës nuk është valide." };

  const res = await setJobTitleArchived(company.companyId, parsed.data.id, false, company.userId);
  if (!res.ok) return mutationError(res.code, res.message);

  revalidateJobTitlePaths();
  return { ok: true };
}
