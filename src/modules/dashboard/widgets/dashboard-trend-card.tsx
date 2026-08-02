"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { ArrowRight, EyeOff } from "lucide-react";
import { ChartFrame, ChartSkeleton } from "@/components/patterns/chart-frame";
import { formatEur } from "@/modules/employees/components/employees-labels";
import {
  MaskedAmount,
  useSalaryVisibility,
} from "@/modules/employees/components/salary-visibility";
import { payrollMonthLabel } from "@/modules/payroll/helpers/month-label";
import type { DashboardCostMetrics } from "../services/dashboard-metrics-service";

/**
 * Payroll cost over the year — gross, net and employer cost together.
 *
 * The old card drew gross only, as bare divs with no axis: you could see a shape
 * but not read a value, and the employer-side burden (the number that actually
 * decides affordability) was missing entirely. This reuses the same chart the
 * Raportet page already renders, so both surfaces tell the same story the same way.
 *
 * recharts is loaded on the client only — it must not enter the server bundle.
 */
const PayrollCostChart = dynamic(
  () => import("@/modules/reports/components/charts/report-charts").then((m) => m.PayrollCostChart),
  { ssr: false, loading: () => <ChartSkeleton height={280} /> },
);

const MIN_POINTS_FOR_TREND = 2;

/**
 * Stands in for the chart while "Fshih pagat" is on. The chart's own euro axis is
 * drawn by the shared Raportet component and can't be masked from here, so the
 * whole plot steps aside rather than leaking the figures the rest of the page hides.
 */
function HiddenChart() {
  return (
    <div className="flex h-[280px] flex-col items-center justify-center gap-2 rounded-lg bg-[#f8fafc] text-center">
      <EyeOff className="h-5 w-5 text-[#94a3b8]" aria-hidden />
      <p className="text-[13px] font-semibold text-[#475569]">Shumat janë të fshehura</p>
      <p className="max-w-[280px] text-[12px] text-[#94a3b8]">
        Zgjidh «Shfaq pagat» lart për të parë trendin e kostos.
      </p>
    </div>
  );
}

export function DashboardBrutoTrendCard({
  metrics,
  year,
}: {
  metrics: DashboardCostMetrics;
  year: number;
}) {
  const { hidden } = useSalaryVisibility();
  const series = metrics.series;

  if (series.length < MIN_POINTS_FOR_TREND) {
    const current = metrics.current;
    return (
      <section className="rounded-xl border border-[#e2e8f0] bg-white px-[22px] py-5 shadow-[0_1px_3px_rgba(15,23,42,0.05)]">
        <h3 className="text-[15px] font-bold text-[#0f172a]">Trendi i kostos së pagave</h3>
        <p className="mt-1 text-[13px] leading-relaxed text-[#64748b]">
          {current
            ? `Vetëm një periudhë e llogaritur për ${year} — trendi shfaqet pas periudhës së dytë.`
            : `Ende asnjë pagë e llogaritur për ${year}.`}
        </p>
        {current ? (
          <p className="mt-3 text-[22px] font-extrabold tabular-nums text-brand-navy">
            <MaskedAmount value={formatEur(current.employerCost)} />
            <span className="ml-2 text-[12px] font-semibold text-[#64748b]">
              kosto punëdhënësi · {payrollMonthLabel(current.year, current.month)}
            </span>
          </p>
        ) : (
          <Link
            href="/pagat"
            className="mt-3 inline-flex items-center gap-1.5 text-[13px] font-semibold text-brand-blue hover:underline"
          >
            Krijo payroll-in e parë
            <ArrowRight className="h-3.5 w-3.5" aria-hidden />
          </Link>
        )}
      </section>
    );
  }

  const first = series[0]!;
  const last = series[series.length - 1]!;
  const mom = metrics.momEmployerCostPct;
  const yoy = metrics.yoyEmployerCostPct;

  const summary = `Kostoja e punëdhënësit nga ${first.label} deri ${last.label} ${year}, me bruto dhe neto për krahasim.`;
  // The percentages stay while masked — a change of 4% discloses no amount, and
  // it is the part of this sentence that carries the finding.
  const fallbackParts = [`${series.length} periudha të llogaritura në ${year}.`];
  if (!hidden) {
    fallbackParts.push(
      `${payrollMonthLabel(last.year, last.month)}: ${formatEur(last.employerCost)} kosto punëdhënësi, ${formatEur(last.gross)} bruto, ${formatEur(last.net)} neto.`,
    );
  }
  if (mom != null) {
    fallbackParts.push(
      `${mom > 0 ? "Rritje" : mom < 0 ? "Rënie" : "Pa ndryshim"} prej ${Math.abs(mom).toFixed(1)}% kundrejt muajit paraardhës.`,
    );
  }
  if (yoy != null) {
    fallbackParts.push(`${yoy > 0 ? "+" : ""}${yoy.toFixed(1)}% kundrejt të njëjtit muaj një vit më parë.`);
  }
  if (series.some((p) => p.isDraft)) {
    fallbackParts.push("Periudhat në draft janë ende në ndryshim.");
  }

  return (
    <section>
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h3 className="text-[15px] font-bold text-[#0f172a]">Trendi i kostos së pagave · {year}</h3>
        <Link
          href="/raportet"
          className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-brand-blue hover:underline"
        >
          Analizë e plotë
          <ArrowRight className="h-3.5 w-3.5" aria-hidden />
        </Link>
      </div>
      <ChartFrame
        summary={hidden ? "Trendi i kostos është i fshehur nga ekrani." : summary}
        fallback={fallbackParts.join(" ")}
      >
        {hidden ? <HiddenChart /> : <PayrollCostChart data={series} />}
      </ChartFrame>
    </section>
  );
}
