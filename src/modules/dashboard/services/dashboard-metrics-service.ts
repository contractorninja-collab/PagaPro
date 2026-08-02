import { payrollCostSeries, type PayrollCostPoint } from "@/modules/reports/services/report-analytics-service";

/**
 * The comparisons that turn dashboard figures into information.
 *
 * A payroll total on its own says nothing — "€41,320" is only meaningful next to
 * last month, the same month last year, and the year so far. All of it is derived
 * from `payrollCostSeries`, which Raportet already computes; nothing new is
 * queried beyond a second year when the previous month falls before January.
 */

export interface DashboardCostMetrics {
  /** The filter year's series, ready for the chart (months without payroll are absent). */
  series: PayrollCostPoint[];
  current: PayrollCostPoint | null;
  /** The calendar month before the filtered one, even across a year boundary. */
  previous: PayrollCostPoint | null;
  sameMonthLastYear: PayrollCostPoint | null;
  /** Finalised months only — a DRAFT period is still being edited. */
  ytd: { gross: number; net: number; employerCost: number; months: number };
  averageEmployerCostPerEmployee: number | null;
  /** Percentage change in employer cost; null when there is no baseline to compare against. */
  momEmployerCostPct: number | null;
  yoyEmployerCostPct: number | null;
}

/** Null rather than Infinity when the baseline is zero — "+∞%" is not a fact. */
function pctChange(from: number, to: number): number | null {
  if (!Number.isFinite(from) || !Number.isFinite(to) || from === 0) return null;
  return Math.round(((to - from) / Math.abs(from)) * 1000) / 10;
}

function findPoint(series: PayrollCostPoint[], year: number, month: number): PayrollCostPoint | null {
  return series.find((p) => p.year === year && p.month === month) ?? null;
}

/**
 * Pure derivation — every branch that could divide by zero or compare against a
 * month that was never run lives here, so it can be tested without a database.
 */
export function deriveCostMetrics(params: {
  year: number;
  month: number;
  /** The filtered year's series. */
  series: PayrollCostPoint[];
  /** The previous year's series; empty when the comparison isn't needed. */
  previousYearSeries: PayrollCostPoint[];
}): DashboardCostMetrics {
  const { year, month, series, previousYearSeries } = params;
  const prevMonthYear = month === 1 ? year - 1 : year;
  const prevMonth = month === 1 ? 12 : month - 1;
  const prevMonthSeries = prevMonthYear === year ? series : previousYearSeries;

  const current = findPoint(series, year, month);
  const previous = findPoint(prevMonthSeries, prevMonthYear, prevMonth);
  const sameMonthLastYear = findPoint(previousYearSeries, year - 1, month);

  const finalised = series.filter((p) => !p.isDraft && p.month <= month);
  const ytd = finalised.reduce(
    (acc, p) => ({
      gross: acc.gross + p.gross,
      net: acc.net + p.net,
      employerCost: acc.employerCost + p.employerCost,
      months: acc.months + 1,
    }),
    { gross: 0, net: 0, employerCost: 0, months: 0 },
  );

  return {
    series,
    current,
    previous,
    sameMonthLastYear,
    ytd: {
      gross: Math.round(ytd.gross * 100) / 100,
      net: Math.round(ytd.net * 100) / 100,
      employerCost: Math.round(ytd.employerCost * 100) / 100,
      months: ytd.months,
    },
    averageEmployerCostPerEmployee:
      current != null && current.employees > 0
        ? Math.round((current.employerCost / current.employees) * 100) / 100
        : null,
    momEmployerCostPct:
      current != null && previous != null
        ? pctChange(previous.employerCost, current.employerCost)
        : null,
    yoyEmployerCostPct:
      current != null && sameMonthLastYear != null
        ? pctChange(sameMonthLastYear.employerCost, current.employerCost)
        : null,
  };
}

export async function loadDashboardCostMetrics(
  companyId: string,
  year: number,
  month: number,
): Promise<DashboardCostMetrics> {
  // Both comparisons can reach into the previous calendar year, so at most two
  // years are ever fetched.
  const [series, previousYearSeries] = await Promise.all([
    payrollCostSeries(companyId, year),
    payrollCostSeries(companyId, year - 1),
  ]);
  return deriveCostMetrics({ year, month, series, previousYearSeries });
}
