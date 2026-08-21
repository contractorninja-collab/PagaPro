import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { runMonthlyLeaveAccrualForCompany } from "@/modules/leaves/services/leave-accrual-service";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Daily leave-accrual sweep (Art 36), invoked by Vercel Cron — see vercel.json.
 *
 * Every ACTIVE company gets accrual posted for the last LOOKBACK_MONTHS
 * *completed* UTC months. The in-progress month is deliberately excluded: the
 * 1.5-day credit is for a month worked, so it lands on the 1st of the month
 * after — posting it early would over-credit an employee who leaves mid-month.
 * The lookback (rather than previous-month-only) self-heals gaps: months HR
 * never posted by hand, companies created mid-year, employees hired since the
 * month's first run. Everything downstream is idempotent per employee-month.
 *
 * Auth: Vercel Cron sends `Authorization: Bearer ${CRON_SECRET}` automatically
 * when the env var is set. Like the LEAVE_ACCRUAL_JOB_SECRET branch of
 * api/leaves/monthly-accrual, this route is exempt from getCompanyContext —
 * there is no user; the secret is the gate.
 */
const LOOKBACK_MONTHS = 12;

function completedMonthsUtc(now: Date): Array<{ year: number; month: number }> {
  const months: Array<{ year: number; month: number }> = [];
  for (let back = LOOKBACK_MONTHS; back >= 1; back--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - back, 1, 12, 0, 0, 0));
    months.push({ year: d.getUTCFullYear(), month: d.getUTCMonth() + 1 });
  }
  return months;
}

export async function GET(req: Request): Promise<NextResponse> {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) {
    return NextResponse.json({ ok: false, error: "CRON_SECRET not configured" }, { status: 503 });
  }
  const authHeader = req.headers.get("authorization")?.trim() ?? "";
  if (authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const months = completedMonthsUtc(new Date());
  const companies = await prisma.company.findMany({
    where: { status: "ACTIVE" },
    select: { id: true, legalName: true },
    orderBy: { legalName: "asc" },
  });

  let created = 0;
  let skipped = 0;
  const failures: string[] = [];

  for (const company of companies) {
    for (const m of months) {
      try {
        const r = await runMonthlyLeaveAccrualForCompany({
          companyId: company.id,
          periodYear: m.year,
          periodMonth: m.month,
        });
        created += r.created;
        skipped += r.skipped;
        if (r.created > 0) {
          console.log(
            `[cron/leave-accrual] ${company.legalName}: ${m.year}-${String(m.month).padStart(2, "0")} +${r.created} rows`,
          );
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : "unknown error";
        failures.push(`${company.legalName} ${m.year}-${String(m.month).padStart(2, "0")}: ${msg}`);
        console.error(`[cron/leave-accrual] FAILED ${company.legalName} ${m.year}-${m.month}: ${msg}`);
      }
    }
  }

  console.log(
    `[cron/leave-accrual] done — ${companies.length} companies, ${months.length} months, created ${created}, skipped ${skipped}, failures ${failures.length}`,
  );
  return NextResponse.json({
    ok: failures.length === 0,
    companies: companies.length,
    monthsChecked: months.length,
    created,
    skipped,
    failures,
  });
}
