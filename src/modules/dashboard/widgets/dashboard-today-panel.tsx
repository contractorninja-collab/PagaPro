import Link from "next/link";
import { ArrowRight, CalendarDays, ScanLine, Sparkles } from "lucide-react";
import { formatEur, formatSqDate } from "@/modules/employees/components/employees-labels";
import { MaskedAmount } from "@/modules/employees/components/salary-visibility";
import { payrollMonthLabel } from "@/modules/payroll/helpers/month-label";
import type { DashboardContractorSlice, DashboardTodaySlice } from "../types/dashboard-types";

const CARD =
  "rounded-xl border border-line bg-white shadow-card";

const CONTRACTOR_STATUS_SQ: Record<"DRAFT" | "LOCKED" | "ARCHIVED", string> = {
  DRAFT: "Draft",
  LOCKED: "I kyçur",
  ARCHIVED: "I arkivuar",
};

/**
 * "Is today normal?" — who is away, who has scanned in, and what is coming.
 *
 * The header of the old action centre printed "Sot: N miratuar · N refuzuar",
 * which counts *decisions taken* today and reads as if it were telling you who
 * is absent. This answers the question that was being asked.
 */
export function DashboardTodayPanel({
  today,
  contractor,
}: {
  today: DashboardTodaySlice;
  contractor: DashboardContractorSlice;
}) {
  const remaining = today.onLeaveTotal - today.onLeave.length;

  return (
    <section className="space-y-4" aria-label="Sot">
      <div className={CARD}>
        <div className="flex items-center justify-between gap-3 border-b border-fill px-[18px] py-3">
          <h3 className="flex items-center gap-2 text-[14px] font-bold text-ink-900">
            <CalendarDays className="h-4 w-4 text-ink-500" aria-hidden />
            Sot në pushim
          </h3>
          <span className="rounded-full bg-fill px-2 py-0.5 text-[12px] font-bold tabular-nums text-ink-700">
            {today.onLeaveTotal}
          </span>
        </div>

        {today.onLeave.length === 0 ? (
          <p className="px-[18px] py-5 text-[13px] text-ink-500">
            Askush nuk është në pushim sot — i gjithë ekipi është në dispozicion.
          </p>
        ) : (
          <ul className="m-0 list-none divide-y divide-fill p-0">
            {today.onLeave.map((row) => (
              <li key={row.leaveId} className="px-[18px] py-2.5">
                <Link
                  href={`/punonjesit/${row.employeeId}`}
                  className="flex items-baseline justify-between gap-3 hover:underline"
                >
                  <span className="min-w-0 truncate text-[13px] font-semibold text-ink-900">
                    {row.employeeName}
                  </span>
                  <span className="shrink-0 text-[11.5px] text-ink-500">{row.typeLabel}</span>
                </Link>
                <p className="text-[11.5px] text-ink-400">
                  kthehet pas {formatSqDate(row.endDateIso)}
                </p>
              </li>
            ))}
            {remaining > 0 ? (
              <li className="px-[18px] py-2.5">
                <Link
                  href="/pushimet"
                  className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-brand-blue hover:underline"
                >
                  edhe {remaining} të tjerë
                  <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                </Link>
              </li>
            ) : null}
          </ul>
        )}

        {today.nextHoliday ? (
          <p className="flex items-center gap-1.5 border-t border-fill px-[18px] py-2.5 text-[12px] text-ink-500">
            <Sparkles className="h-3.5 w-3.5 shrink-0 text-ink-400" aria-hidden />
            Festa e radhës: <strong className="font-semibold text-ink-700">
              {today.nextHoliday.name}
            </strong>{" "}
            · {formatSqDate(today.nextHoliday.dateIso)}
          </p>
        ) : null}
      </div>

      {today.timeClock ? (
        <div className={CARD}>
          <div className="flex items-center justify-between gap-3 border-b border-fill px-[18px] py-3">
            <h3 className="flex items-center gap-2 text-[14px] font-bold text-ink-900">
              <ScanLine className="h-4 w-4 text-ink-500" aria-hidden />
              Ora e punës
            </h3>
          </div>
          <dl className="grid grid-cols-3 gap-2 px-[18px] py-3.5">
            <div>
              <dt className="text-[11px] font-bold uppercase tracking-[0.04em] text-ink-400">
                Brenda
              </dt>
              <dd className="mt-0.5 text-[18px] font-extrabold tabular-nums text-ink-900">
                {today.timeClock.clockedIn}
              </dd>
            </div>
            <div>
              <dt className="text-[11px] font-bold uppercase tracking-[0.04em] text-ink-400">
                Skanime
              </dt>
              <dd className="mt-0.5 text-[18px] font-extrabold tabular-nums text-ink-900">
                {today.timeClock.punchesToday}
              </dd>
            </div>
            <div>
              <dt className="text-[11px] font-bold uppercase tracking-[0.04em] text-ink-400">
                Për rishikim
              </dt>
              <dd
                className={
                  today.timeClock.needsReview > 0
                    ? "mt-0.5 text-[18px] font-extrabold tabular-nums text-[#b45309]"
                    : "mt-0.5 text-[18px] font-extrabold tabular-nums text-ink-900"
                }
              >
                {today.timeClock.needsReview}
              </dd>
            </div>
          </dl>
          {today.timeClock.needsReview > 0 ? (
            <p className="border-t border-fill px-[18px] py-2.5 text-[11.5px] text-ink-500">
              Ditë me skanime të papërputhura — orët nuk llogariten derisa të rregullohen.
            </p>
          ) : null}
        </div>
      ) : null}

      {contractor.enabled ? (
        <div className={CARD}>
          <div className="flex items-center justify-between gap-3 border-b border-fill px-[18px] py-3">
            <h3 className="text-[14px] font-bold text-ink-900">Payroll kontraktorësh</h3>
          </div>
          {contractor.latest ? (
            <div className="px-[18px] py-3.5">
              <p className="text-[12px] text-ink-500">
                {payrollMonthLabel(contractor.latest.year, contractor.latest.month)} ·{" "}
                {CONTRACTOR_STATUS_SQ[contractor.latest.status]}
              </p>
              <p className="mt-1 text-[20px] font-extrabold tabular-nums text-brand-navy">
                <MaskedAmount value={formatEur(contractor.latest.totalGross)} />
              </p>
              <p className="text-[11.5px] text-ink-400">
                {contractor.latest.entryCount} kontraktorë
              </p>
              <Link
                href={`/pagat/kontraktor/${contractor.latest.id}`}
                className="mt-2 inline-flex items-center gap-1 text-[12.5px] font-semibold text-brand-blue hover:underline"
              >
                Hap periudhën
                <ArrowRight className="h-3.5 w-3.5" aria-hidden />
              </Link>
            </div>
          ) : (
            <div className="px-[18px] py-4">
              <p className="text-[13px] text-ink-500">Ende asnjë periudhë kontraktorësh.</p>
              <Link
                href="/pagat/kontraktor"
                className="mt-2 inline-flex items-center gap-1 text-[12.5px] font-semibold text-brand-blue hover:underline"
              >
                Krijo periudhën e parë
                <ArrowRight className="h-3.5 w-3.5" aria-hidden />
              </Link>
            </div>
          )}
        </div>
      ) : null}
    </section>
  );
}
