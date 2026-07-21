"use server";

import { revalidatePath } from "next/cache";
import { getCompanyContext, companyContextErrorMessage } from "@/server/company-context";
import {
  computeAnnexDiff,
  createEmployeeContractAnnex,
  deleteEmployeeContractAnnex,
  getAnnexPanelData,
  updateContractTerm,
  type AnnexPanelData,
} from "@/modules/annex/services/annex-service";
import {
  contractTermTypeSchema,
  createAnnexSchema,
  employeeIdSchema,
} from "@/modules/annex/validators/annex-schemas";
import { z } from "zod";
import type { AnnexDiff } from "@/modules/annex/types";

export type AnnexActionResult<T = undefined> =
  | { ok: true; data?: T }
  | { ok: false; error: string };

/** Fetches the pre-filled diff for the "Gjenero Aneks" dialog. */
export async function getAnnexDiffAction(raw: unknown): Promise<AnnexActionResult<AnnexDiff>> {
  const ctx = await getCompanyContext();
  if (!ctx.ok) return { ok: false, error: companyContextErrorMessage(ctx.reason) };
  const { companyId } = ctx.context;

  const parsed = employeeIdSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "ID e pavlefshme." };

  const res = await computeAnnexDiff(companyId, parsed.data.employeeId);
  if (!res.ok) return res;
  return { ok: true, data: res.diff };
}

export async function getAnnexPanelDataAction(
  raw: unknown,
): Promise<AnnexActionResult<AnnexPanelData>> {
  const ctx = await getCompanyContext();
  if (!ctx.ok) return { ok: false, error: companyContextErrorMessage(ctx.reason) };
  const parsed = employeeIdSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "ID e pavlefshme." };

  const res = await getAnnexPanelData(ctx.context.companyId, parsed.data.employeeId);
  if (!res.ok) return res;
  return { ok: true, data: res.data };
}

const updateContractTermSchema = z.object({
  employeeId: z.string().min(1),
  contractType: contractTermTypeSchema,
  contractEndDate: z.string().nullable(),
});

export async function updateContractTermAction(raw: unknown): Promise<AnnexActionResult> {
  const ctx = await getCompanyContext();
  if (!ctx.ok) return { ok: false, error: companyContextErrorMessage(ctx.reason) };
  const parsed = updateContractTermSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues.map((i) => i.message).join("; ") };
  }

  let endDate: Date | null = null;
  if (parsed.data.contractEndDate) {
    endDate = new Date(parsed.data.contractEndDate);
    if (Number.isNaN(endDate.getTime())) {
      return { ok: false, error: "Data e skadimit është e pavlefshme." };
    }
  }
  // An indefinite contract has no end date.
  if (parsed.data.contractType === "INDEFINITE") endDate = null;

  const res = await updateContractTerm(
    ctx.context.companyId,
    parsed.data.employeeId,
    { contractType: parsed.data.contractType, contractEndDate: endDate },
    ctx.context.user.id,
  );
  if (!res.ok) return res;
  try {
    revalidatePath(`/punonjesit/${parsed.data.employeeId}`);
  } catch {
    /* ignore */
  }
  return { ok: true };
}

const annexIdSchema = z.object({ annexId: z.string().min(1) });

export async function deleteAnnexAction(raw: unknown): Promise<AnnexActionResult> {
  const ctx = await getCompanyContext();
  if (!ctx.ok) return { ok: false, error: companyContextErrorMessage(ctx.reason) };
  const parsed = annexIdSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "ID e pavlefshme." };

  const res = await deleteEmployeeContractAnnex(
    ctx.context.companyId,
    parsed.data.annexId,
    ctx.context.user.id,
  );
  if (!res.ok) return res;
  try {
    revalidatePath(`/punonjesit/${res.employeeId}`);
  } catch {
    /* ignore */
  }
  return { ok: true };
}

export async function createAnnexAction(
  raw: unknown,
): Promise<AnnexActionResult<{ id: string; annexNumber: number }>> {
  const ctx = await getCompanyContext();
  if (!ctx.ok) return { ok: false, error: companyContextErrorMessage(ctx.reason) };
  const { companyId, user } = ctx.context;

  const parsed = createAnnexSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues.map((i) => i.message).join("; ") };
  }

  const effectiveDate = new Date(parsed.data.effectiveDate);
  if (Number.isNaN(effectiveDate.getTime())) {
    return { ok: false, error: "Data e hyrjes në fuqi është e pavlefshme." };
  }

  const renewalProvided =
    parsed.data.contractType !== undefined || parsed.data.contractEndDate !== undefined;
  const contractEndDate =
    parsed.data.contractEndDate === undefined
      ? undefined
      : parsed.data.contractEndDate === null
        ? null
        : new Date(parsed.data.contractEndDate);
  if (contractEndDate instanceof Date && Number.isNaN(contractEndDate.getTime())) {
    return { ok: false, error: "Data e skadimit të kontratës është e pavlefshme." };
  }

  const res = await createEmployeeContractAnnex(
    companyId,
    {
      employeeId: parsed.data.employeeId,
      effectiveDate,
      changes: parsed.data.changes,
      ...(renewalProvided
        ? { contractType: parsed.data.contractType, contractEndDate }
        : {}),
    },
    user.id,
  );
  if (!res.ok) return res;

  try {
    revalidatePath(`/punonjesit/${parsed.data.employeeId}`);
  } catch {
    /* ignore */
  }
  return { ok: true, data: { id: res.id, annexNumber: res.annexNumber } };
}
