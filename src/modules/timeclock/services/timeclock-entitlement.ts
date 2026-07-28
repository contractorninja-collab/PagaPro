import { prisma } from "@/lib/prisma";

/**
 * The badge time clock is a per-client entitlement set from the admin console.
 * Read it server-side wherever the feature surfaces — hiding UI is not a gate,
 * and `CompanyConfiguration` deliberately does not carry this flag because
 * clients can edit that record themselves.
 */
export async function isTimeClockEnabled(companyId: string): Promise<boolean> {
  const row = await prisma.company.findUnique({
    where: { id: companyId },
    select: { timeClockEnabled: true },
  });
  return row?.timeClockEnabled ?? false;
}
