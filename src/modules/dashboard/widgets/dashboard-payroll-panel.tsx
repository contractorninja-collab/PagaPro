import Link from "next/link";
import type { PayrollPeriodStatus } from "@prisma/client";
import { ArrowRight, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatEur } from "@/modules/employees/components/employees-labels";
import { payrollMonthLabel } from "@/modules/payroll/helpers/month-label";
import type { DashboardPayrollSlice } from "../types/dashboard-types";
import { PAYROLL_STATUS_LABELS_SQ } from "../helpers/dashboard-labels";

/** Status pill tones tuned for the navy hero background. */
const DARK_PILL: Record<PayrollPeriodStatus, { chip: string; dot: string }> = {
  DRAFT: { chip: "bg-[rgba(245,158,11,0.16)] text-[#fbbf24]", dot: "bg-[#fbbf24]" },
  REVIEWED: { chip: "bg-[rgba(59,130,246,0.2)] text-[#93c5fd]", dot: "bg-[#60a5fa]" },
  APPROVED: { chip: "bg-[rgba(34,197,94,0.16)] text-[#4ade80]", dot: "bg-[#4ade80]" },
  LOCKED: { chip: "bg-white text-brand-navy", dot: "" },
  ARCHIVED: { chip: "bg-white/10 text-[#cbd5e1]", dot: "bg-[#94a3b8]" },
};

/** Workflow progress: Draft → Shqyrtim → Miratim → Kyçje. */
const STATUS_PROGRESS: Record<PayrollPeriodStatus, number> = {
  DRAFT: 25,
  REVIEWED: 50,
  APPROVED: 75,
  LOCKED: 100,
  ARCHIVED: 100,
};

export function DashboardPayrollPanel({ payroll }: { payroll: DashboardPayrollSlice }) {
  const label = payrollMonthLabel(payroll.year, payroll.month);
  const hasPayroll = payroll.payrollId != null && payroll.status != null;
  const pill = payroll.status ? DARK_PILL[payroll.status] : null;
  const progress = payroll.status ? STATUS_PROGRESS[payroll.status] : 0;

  return (
    <section
      aria-labelledby="dashboard-payroll-hero-title"
      className="relative overflow-hidden rounded-2xl bg-brand-navy p-[22px] text-[#e8edf5] shadow-[0_1px_3px_rgba(15,23,42,0.05)]"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 [background:radial-gradient(130%_120%_at_100%_0,rgba(37,99,235,0.22),transparent_55%)]"
      />
      <div className="relative">
        <div className="mb-[18px] flex flex-wrap items-center justify-between gap-2">
          <h2
            id="dashboard-payroll-hero-title"
            className="text-[12px] font-semibold uppercase tracking-[0.05em] text-[#8b95a7]"
          >
            Payroll {label}
          </h2>
          {payroll.status && pill ? (
            <span
              className={cn(
                "inline-flex h-[23px] items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 text-[11.5px] font-semibold",
                pill.chip,
              )}
            >
              {payroll.status === "LOCKED" ? (
                <Lock className="h-[11px] w-[11px]" strokeWidth={2.5} aria-hidden />
              ) : (
                <span className={cn("h-1.5 w-1.5 rounded-full", pill.dot)} aria-hidden />
              )}
              {PAYROLL_STATUS_LABELS_SQ[payroll.status]}
            </span>
          ) : (
            <span className="inline-flex h-[23px] items-center gap-1.5 whitespace-nowrap rounded-full bg-white/10 px-2.5 text-[11.5px] font-semibold text-[#cbd5e1]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#94a3b8]" aria-hidden />
              Pa payroll
            </span>
          )}
        </div>

        <p className="text-[34px] font-extrabold leading-none tracking-[-0.03em] text-white tabular-nums">
          {formatEur(payroll.totals.grossSalary)}
        </p>
        <p className="mt-1.5 text-[12.5px] text-[#8b95a7]">
          Bruto totale · {payroll.employeeCount} punonjës
        </p>

        <dl className="my-5 flex flex-wrap gap-x-[22px] gap-y-3">
          <div>
            <dt className="mb-0.5 text-[11.5px] text-[#8b95a7]">Neto</dt>
            <dd className="text-[16px] font-bold text-white tabular-nums">
              {formatEur(payroll.totals.netPay)}
            </dd>
          </div>
          <div>
            <dt className="mb-0.5 text-[11.5px] text-[#8b95a7]">Kosto punëdhënësi</dt>
            <dd className="text-[16px] font-bold text-white tabular-nums">
              {formatEur(payroll.totals.employerTotalCost)}
            </dd>
          </div>
        </dl>

        <div className="mb-4">
          <div className="mb-1.5 flex items-center justify-between text-[11.5px] text-[#8b95a7]">
            <span>Draft → Shqyrtim → Miratim → Kyçje</span>
            <span className="font-semibold text-[#cbd5e1] tabular-nums">{progress}%</span>
          </div>
          <div className="h-[7px] overflow-hidden rounded-md bg-white/10">
            <div
              className="h-full rounded-md bg-brand-blue"
              style={{ width: `${progress}%` }}
              aria-hidden
            />
          </div>
        </div>

        {hasPayroll ? (
          <Link
            href={`/pagat/${payroll.payrollId}`}
            className="flex h-[42px] w-full items-center justify-center rounded-[10px] bg-brand-blue text-[14px] font-semibold text-white transition-colors hover:bg-[#1d4ed8]"
          >
            Vazhdo shqyrtimin
            <ArrowRight className="ml-1.5 h-4 w-4" aria-hidden />
          </Link>
        ) : (
          <Link
            href="/pagat"
            className="flex h-[42px] w-full items-center justify-center rounded-[10px] bg-brand-blue text-[14px] font-semibold text-white transition-colors hover:bg-[#1d4ed8]"
          >
            Krijo payroll për muajin
          </Link>
        )}

        <div className="mt-3 flex items-center justify-center gap-3 text-[12.5px] font-semibold">
          <Link href="/pagat" className="text-[#8b95a7] transition-colors hover:text-white">
            Hap pagat
          </Link>
          {hasPayroll ? (
            <>
              <span className="text-white/20" aria-hidden>
                ·
              </span>
              <Link
                href={`/pagat/${payroll.payrollId}`}
                className="text-[#8b95a7] transition-colors hover:text-white"
              >
                Gjenero eksporte
              </Link>
            </>
          ) : null}
        </div>
      </div>
    </section>
  );
}

export function DashboardPayrollPanelSkeleton() {
  return (
    <div aria-hidden className="rounded-2xl bg-brand-navy p-[22px]">
      <div className="mb-5 flex items-center justify-between">
        <div className="h-3 w-28 animate-pulse rounded bg-white/10" />
        <div className="h-5 w-24 animate-pulse rounded-full bg-white/10" />
      </div>
      <div className="h-9 w-44 max-w-full animate-pulse rounded bg-white/10" />
      <div className="mt-2 h-3 w-36 animate-pulse rounded bg-white/10" />
      <div className="my-5 flex gap-6">
        <div className="h-10 w-24 animate-pulse rounded bg-white/10" />
        <div className="h-10 w-24 animate-pulse rounded bg-white/10" />
      </div>
      <div className="h-[7px] w-full animate-pulse rounded bg-white/10" />
      <div className="mt-4 h-[42px] w-full animate-pulse rounded-[10px] bg-white/10" />
    </div>
  );
}
