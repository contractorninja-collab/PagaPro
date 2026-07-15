import { cn } from "@/lib/utils";
import { formatEur } from "@/modules/employees/components/employees-labels";
import { payrollMonthLabel, payrollMonthNameSq } from "@/modules/payroll/helpers/month-label";
import type { DashboardPayrollSlice } from "../types/dashboard-types";

/**
 * Bruto-salary trend card (1b) — six monthly bar slots ending at the filtered
 * period. The operational DTO exposes only the selected period's payroll totals,
 * so the earlier months render as empty-state slots until history is available.
 */
export function DashboardBrutoTrendCard({ payroll }: { payroll: DashboardPayrollSlice }) {
  const slots = Array.from({ length: 6 }, (_, i) => {
    const offset = 5 - i;
    let month = payroll.month - offset;
    let year = payroll.year;
    while (month < 1) {
      month += 12;
      year -= 1;
    }
    return { year, month };
  });

  const gross = Number(payroll.totals.grossSalary);
  // Payroll ekziston → shfaq vlerën edhe kur bruto është 0 (mos sugjero që s'ka payroll).
  const currentGross =
    payroll.payrollId != null && Number.isFinite(gross) && gross >= 0 ? gross : null;

  return (
    <div className="rounded-[14px] border border-[#e2e8f0] bg-white px-[22px] py-5 shadow-[0_1px_3px_rgba(15,23,42,0.05)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-[15px] font-bold text-[#0f172a]">Trendi i pagave bruto</h3>
          <p className="mt-0.5 text-[12px] text-[#94a3b8]">
            Gjashtë muajt deri më {payrollMonthLabel(payroll.year, payroll.month)}
          </p>
        </div>
        <div className="text-right">
          <p className="text-[22px] font-extrabold tracking-[-0.02em] text-brand-navy tabular-nums">
            {currentGross != null ? formatEur(currentGross) : "—"}
          </p>
          <p className="text-[12px] font-semibold text-[#64748b]">Bruto · periudha e zgjedhur</p>
        </div>
      </div>

      <div className="mt-3.5 flex h-24 items-end gap-4 px-0.5">
        {slots.map((s, i) => {
          const isCurrent = i === slots.length - 1;
          const value = isCurrent ? currentGross : null;
          return (
            <div
              key={`${s.year}-${s.month}`}
              className="flex min-w-0 flex-1 flex-col items-center justify-end gap-[7px]"
            >
              {value != null ? (
                <div
                  className="h-[88px] w-full max-w-[44px] rounded-t-md bg-brand-blue"
                  title={formatEur(value)}
                />
              ) : (
                <div
                  className={cn(
                    "h-1 w-full max-w-[44px] rounded-full",
                    isCurrent ? "bg-[#cbd5e1]" : "bg-[#e2e8f0]",
                  )}
                  aria-hidden
                />
              )}
              <span
                className={cn(
                  "text-[11px]",
                  isCurrent ? "font-semibold text-[#0f172a]" : "text-[#94a3b8]",
                )}
              >
                {payrollMonthNameSq(s.month).slice(0, 3)}
              </span>
            </div>
          );
        })}
      </div>

      <p className="mt-3 border-t border-[#f1f5f9] pt-2.5 text-[11.5px] text-[#94a3b8]">
        {currentGross != null
          ? "Shfaqet periudha e zgjedhur — historiku i muajve të tjerë nuk është ende i disponueshëm në panel."
          : "Nuk ka të dhëna pagash për periudhën e zgjedhur — krijoni payroll-in që trendi të shfaqet."}
      </p>
    </div>
  );
}
