import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/**
 * TEMPORARY diagnostic (CRON_SECRET-gated, not scheduled): how much contract
 * term data actually exists, so we know whether the expiry alert can fire.
 * Counts only, plus names for the two lists that are actionable. Remove after use.
 */
export async function GET(req: Request): Promise<NextResponse> {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return NextResponse.json({ ok: false }, { status: 503 });
  if ((req.headers.get("authorization")?.trim() ?? "") !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const today = new Date();
  const todayStart = new Date(
    Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()),
  );
  const horizonEnd = new Date(
    Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() + 30, 23, 59, 59, 999),
  );

  const companies = await prisma.company.findMany({
    select: { id: true, legalName: true },
    orderBy: { legalName: "asc" },
  });

  const report: Record<string, unknown> = {};

  for (const c of companies) {
    const live = { companyId: c.id, status: { not: "TERMINATED" as const } };

    const [total, withEnd, fixedNoEnd, expiringSoon, alreadyExpired, byType] = await Promise.all([
      prisma.employee.count({ where: live }),
      prisma.employee.count({ where: { ...live, contractEndDate: { not: null } } }),
      // The gap: a term that ends, with no date recorded for when.
      prisma.employee.count({
        where: {
          ...live,
          contractType: { in: ["FIXED_TERM", "SPECIFIC_TASK"] },
          contractEndDate: null,
        },
      }),
      prisma.employee.findMany({
        where: { ...live, contractEndDate: { not: null, gte: todayStart, lte: horizonEnd } },
        orderBy: { contractEndDate: "asc" },
        select: { firstName: true, lastName: true, contractType: true, contractEndDate: true },
      }),
      // Past their end date and still on the books — already a compliance problem.
      prisma.employee.findMany({
        where: { ...live, contractEndDate: { not: null, lt: todayStart } },
        orderBy: { contractEndDate: "asc" },
        take: 50,
        select: { firstName: true, lastName: true, contractType: true, contractEndDate: true },
      }),
      prisma.employee.groupBy({
        by: ["contractType"],
        where: live,
        _count: { _all: true },
      }),
    ]);

    report[c.legalName] = {
      liveEmployees: total,
      withContractEndDate: withEnd,
      fixedTermMissingEndDate: fixedNoEnd,
      alertWouldShow: expiringSoon.length,
      expiringWithin30Days: expiringSoon.map((e) => ({
        name: `${e.firstName} ${e.lastName}`,
        term: e.contractType,
        ends: e.contractEndDate?.toISOString().slice(0, 10),
      })),
      alreadyExpiredButActive: alreadyExpired.length,
      expiredList: alreadyExpired.map((e) => ({
        name: `${e.firstName} ${e.lastName}`,
        term: e.contractType,
        ended: e.contractEndDate?.toISOString().slice(0, 10),
      })),
      byContractType: Object.fromEntries(byType.map((r) => [r.contractType, r._count._all])),
    };
  }

  return NextResponse.json({ ok: true, generatedAt: today.toISOString(), report });
}
