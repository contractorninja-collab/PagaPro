"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ensureDefaultLeavePolicyParameterSet } from "@/modules/leaves/services/leave-policy-service";
import { syncLeaveBalancesForCompanyYear } from "@/modules/leaves/services/leave-balance-service";
import { companyContextErrorMessage, getCompanyContext } from "@/server/company-context";

const toggleSchema = z.object({ enabled: z.boolean() });

/**
 * Ndez/fik bonusin e përvojës (Ligji i Punës Nr. 03/L-212, Neni 37.2: +1 ditë
 * pushimi vjetor për çdo 5 vjet të plota përvojë pune). Rillogarit menjëherë
 * balancat e vitit aktual që efekti të duket pa pritur akrualin e radhës.
 */
export async function setLeaveTenureBonusAction(
  raw: unknown,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const ctx = await getCompanyContext();
  if (!ctx.ok) return { ok: false, error: companyContextErrorMessage(ctx.reason) };
  const { companyId } = ctx.context;

  const parsed = toggleSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Kërkesë e pavlefshme." };

  try {
    const policy = await ensureDefaultLeavePolicyParameterSet(companyId);
    // The toggle applies to every policy row of the company — the panel exposes
    // one company-wide switch, not per-period history editing.
    await prisma.leavePolicyParameterSet.updateMany({
      where: { companyId },
      data: { enableTenureBonus: parsed.data.enabled },
    });
    void policy;

    await syncLeaveBalancesForCompanyYear(companyId, new Date().getUTCFullYear());

    try {
      revalidatePath("/konfigurime");
      revalidatePath("/pushimet");
    } catch {
      /* ignore */
    }
    return { ok: true };
  } catch (err) {
    console.error("[setLeaveTenureBonusAction] failed:", err);
    return { ok: false, error: "Ndryshimi dështoi papritur." };
  }
}
