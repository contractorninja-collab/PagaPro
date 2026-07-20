import type { LeavePolicyParameterSet } from "@prisma/client";
import { prisma } from "@/lib/prisma";

const DEFAULT_POLICY_EFFECTIVE_FROM = new Date("2000-01-01T00:00:00.000Z");

export async function ensureDefaultLeavePolicyParameterSet(
  companyId: string,
): Promise<LeavePolicyParameterSet> {
  const existing = await prisma.leavePolicyParameterSet.findFirst({
    where: { companyId },
    orderBy: { effectiveFrom: "desc" },
  });
  if (existing) return existing;

  return prisma.leavePolicyParameterSet.create({
    data: {
      companyId,
      effectiveFrom: DEFAULT_POLICY_EFFECTIVE_FROM,
    },
  });
}

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

  return ensureDefaultLeavePolicyParameterSet(companyId);
}
