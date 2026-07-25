"use server";

import { revalidatePath } from "next/cache";
import { companyContextErrorMessage, getCompanyContext } from "@/server/company-context";
import {
  createDisciplinaryWarning,
  deleteDisciplinaryWarning,
  listEmployeeWarnings,
} from "@/modules/warnings/services/warning-service";
import {
  warningCreateSchema,
  warningDeleteSchema,
} from "@/modules/warnings/validators/warning-schemas";
import type { WarningRow } from "@/modules/warnings/types";
import { z } from "zod";

export type WarningActionResult<T = undefined> =
  | { ok: true; data?: T }
  | { ok: false; error: string };

const employeeIdSchema = z.object({ employeeId: z.string().min(1) });

export async function listWarningsAction(raw: unknown): Promise<WarningActionResult<WarningRow[]>> {
  const ctx = await getCompanyContext();
  if (!ctx.ok) return { ok: false, error: companyContextErrorMessage(ctx.reason) };

  const parsed = employeeIdSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "ID e pavlefshme." };

  const rows = await listEmployeeWarnings(ctx.context.companyId, parsed.data.employeeId);
  return { ok: true, data: rows };
}

export async function createWarningAction(raw: unknown): Promise<WarningActionResult<{ id: string }>> {
  const ctx = await getCompanyContext();
  if (!ctx.ok) return { ok: false, error: companyContextErrorMessage(ctx.reason) };

  const parsed = warningCreateSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Të dhëna të pavlefshme." };
  }

  const res = await createDisciplinaryWarning(
    ctx.context.companyId,
    parsed.data,
    ctx.context.user.id,
  );
  if (!res.ok) return res;

  revalidatePath(`/punonjesit/${parsed.data.employeeId}`);
  revalidatePath("/dokumentet");
  return { ok: true, data: { id: res.id } };
}

export async function deleteWarningAction(raw: unknown): Promise<WarningActionResult> {
  const ctx = await getCompanyContext();
  if (!ctx.ok) return { ok: false, error: companyContextErrorMessage(ctx.reason) };

  const parsed = warningDeleteSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "ID e pavlefshme." };

  const res = await deleteDisciplinaryWarning(
    ctx.context.companyId,
    parsed.data.warningId,
    ctx.context.user.id,
  );
  if (!res.ok) return res;

  revalidatePath("/dokumentet");
  return { ok: true };
}
