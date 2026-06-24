import type { LeavePolicyParameterSet } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/** Effective policy row for `at` (UTC instant). Falls back to latest set if gaps exist. */
export async function resolveLeavePolicyParameterSet(
  companyId: string,
  at: Date,
): Promise<LeavePolicyParameterSet> {
  const hit = await prisma.leavePolicyParameterSet.findFirst({
    where: {
      companyId,
      effectiveFrom: { lte: at },
      OR: [{ effectiveTo: null }, { effectiveTo: { gte: at } }],
    },
    orderBy: { effectiveFrom: "desc" },
  });
  if (hit) return hit;

  const fallback = await prisma.leavePolicyParameterSet.findFirst({
    where: { companyId },
    orderBy: { effectiveFrom: "desc" },
  });
  if (fallback) return fallback;

  throw new Error("Mungon LeavePolicyParameterSet për këtë kompani — ekzekutoni migrimet Kosova.");
}
