import { formatEur } from "@/modules/employees/components/employees-labels";
import { payrollMonthLabel, payrollMonthNameSq } from "@/modules/payroll/helpers/month-label";
import type { DashboardPayrollSlice } from "../types/dashboard-types";

const MIN_TREND_PERIODS = 3;

export function DashboardBrutoTrendCard({ payroll }: { payroll: DashboardPayrollSlice }) {
  const history = payroll.grossHistory
    .map((period) => ({ ...period, gross: Number(period.grossSalary) }))
    .filter((period) => Number.isFinite(period.gross) && period.gross >= 0);

  if (history.length < MIN_TREND_PERIODS) {
    const gross = Number(payroll.totals.grossSalary);
    const currentGross =
      payroll.payrollId != null && Number.isFinite(gross) && gross >= 0 ? gross : null;

    return (
      <section className="rounded-lg border border-[#e2e8f0] bg-white px-[22px] py-5 shadow-[0_1px_3px_rgba(15,23,42,0.05)]">
        <p className="text-[10.5px] font-bold uppercase text-[#64748b]">Periudha aktuale</p>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h3 className="text-[15px] font-bold text-[#0f172a]">
              Pagat bruto · {payrollMonthLabel(payroll.year, payroll.month)}
            </h3>
            <p className="mt-1 text-[12px] text-[#94a3b8]">
              {payroll.payrollId
                ? `${payroll.employeeCount} punonjës në këtë cikël`
                : "Payroll ende i pakrijuar"}
            </p>
          </div>
          <p className="text-[28px] font-extrabold leading-none text-brand-navy tabular-nums">
            {currentGross != null ? formatEur(currentGross) : "—"}
          </p>
        </div>
      </section>
    );
  }

  const maxGross = Math.max(...history.map((period) => period.gross), 1);
  const current = history.at(-1)!;

  return (
    <section className="rounded-lg border border-[#e2e8f0] bg-white px-[22px] py-5 shadow-[0_1px_3px_rgba(15,23,42,0.05)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-[15px] font-bold text-[#0f172a]">Trendi i pagave bruto</h3>
          <p className="mt-0.5 text-[12px] text-[#94a3b8]">
            {history.length} periudhat e fundit me të dhëna
          </p>
        </div>
        <div className="text-right">
          <p className="text-[22px] font-extrabold text-brand-navy tabular-nums">
            {formatEur(current.gross)}
          </p>
          <p className="text-[12px] font-semibold text-[#64748b]">
            {payrollMonthLabel(current.year, current.month)}
          </p>
        </div>
      </div>

      <div className="mt-4 flex h-28 items-end gap-3" aria-label="Trendi mujor i pagave bruto">
        {history.map((period) => {
          const height = period.gross === 0 ? 4 : Math.max(10, (period.gross / maxGross) * 88);
          return (
            <div
              key={`${period.year}-${period.month}`}
              className="flex min-w-0 flex-1 flex-col items-center justify-end gap-2"
            >
              <div
                className="w-full max-w-[46px] rounded-t bg-brand-blue"
                style={{ height: `${height}px` }}
                title={`${payrollMonthLabel(period.year, period.month)}: ${formatEur(period.gross)}`}
              />
              <span className="text-[10.5px] font-medium text-[#64748b]">
                {payrollMonthNameSq(period.month).slice(0, 3)}
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
