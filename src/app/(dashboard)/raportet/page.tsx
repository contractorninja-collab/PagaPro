import type { Metadata } from "next";
import { AppSubBar } from "@/components/layout/app-sub-bar";
import { RaportetChartsClient } from "@/modules/reports/components/raportet-charts-client";
import { ReportYearSelect } from "@/modules/reports/components/report-year-select";
import {
  leavePressure,
  payrollCostSeries,
  reportingYears,
  workforceShape,
} from "@/modules/reports/services/report-analytics-service";
import { requireCompanyContextPage } from "@/server/company-context";

export const metadata: Metadata = {
  title: "Raportet",
};

function first(sp: Record<string, string | string[] | undefined>, key: string): string {
  const v = sp[key];
  if (Array.isArray(v)) return v[0] ?? "";
  return typeof v === "string" ? v : "";
}

export default async function RaportetPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { companyId } = await requireCompanyContextPage();

  const sp = await searchParams;
  const raw = Number(first(sp, "year"));
  const defaultYear = new Date().getUTCFullYear();
  // `Number("")` is 0 and 0 is finite — an absent year must not become year 0.
  const requested =
    Number.isInteger(raw) && raw >= 1970 && raw <= 2100 ? raw : defaultYear;

  let years: number[];
  let cost;
  let workforce;
  let leave;

  try {
    years = await reportingYears(companyId, defaultYear);
    const year = years.includes(requested) ? requested : (years[0] ?? defaultYear);

    [cost, workforce, leave] = await Promise.all([
      payrollCostSeries(companyId, year),
      workforceShape(companyId, year),
      leavePressure(companyId, year),
    ]);

    return (
      <>
        <AppSubBar
          eyebrow="Analitika"
          title="Raportet"
          description="Kostoja e pagave, forma e fuqisë punëtore dhe presioni i pushimeve — të gjitha për vitin e zgjedhur."
          actions={<ReportYearSelect year={year} years={years} />}
        />
        <RaportetChartsClient year={year} cost={cost} workforce={workforce} leave={leave} />
      </>
    );
  } catch (err) {
    console.error("[pagapro] RaportetPage: query failed", err);
    return (
      <>
        <AppSubBar eyebrow="Analitika" title="Raportet" />
        <div className="rounded-xl border border-[#fecaca] bg-[#fef2f2] px-5 py-6">
          <p className="text-sm font-semibold text-[#7f1d1d]">
            Të dhënat e raporteve nuk mund të lexohen për momentin.
          </p>
          <p className="mt-1 text-[13px] text-[#991b1b]">
            Rifreskoni faqen. Nëse problemi vazhdon, njoftoni mbështetjen.
          </p>
        </div>
      </>
    );
  }
}
