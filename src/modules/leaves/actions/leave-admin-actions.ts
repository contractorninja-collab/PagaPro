"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { runMonthlyLeaveAccrualForCompany } from "@/modules/leaves/services/leave-accrual-service";
import { resolveActiveCompanyId } from "@/server/company-scope";

const monthlyAccrualBodySchema = z.object({
  periodYear: z.number().int().min(1970).max(2100),
  periodMonth: z.number().int().min(1).max(12),
});

export type LeaveAdminActionResult<T = undefined> =
  | { ok: true; data?: T }
  | { ok: false; error: string };

/** HR: post Art 36 monthly accrual ledger rows for all eligible employees (idempotent per employee-month). */
export async function postMonthlyLeaveAccrualAction(
  raw: unknown,
): Promise<LeaveAdminActionResult<{ created: number; skipped: number }>> {
  const companyId = await resolveActiveCompanyId();
  if (!companyId) return { ok: false, error: "Nuk ka kompani aktive." };

  const parsed = monthlyAccrualBodySchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Viti ose muaji nuk janë të vlefshëm." };

  try {
    const data = await runMonthlyLeaveAccrualForCompany({
      companyId,
      periodYear: parsed.data.periodYear,
      periodMonth: parsed.data.periodMonth,
    });
    revalidatePath("/pushimet");
    revalidatePath("/konfigurime");
    return { ok: true, data };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Akumulimi dështoi." };
  }
}
