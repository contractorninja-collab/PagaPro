import Link from "next/link";
import type { PayrollPeriodStatus } from "@prisma/client";
import { ArrowRight, Clock, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatEur } from "@/modules/employees/components/employees-labels";
import { MaskedAmount } from "@/modules/employees/components/salary-visibility";
import { payrollMonthLabel } from "@/modules/payroll/helpers/month-label";
import type { DashboardPayrollSlice } from "../types/dashboard-types";
import type { DashboardCostMetrics } from "../services/dashboard-metrics-service";
import type { AtkDeadlineItem } from "./dashboard-action-center";
import { PayrollHeroFoldToggle } from "./payroll-hero-fold";
import { PAYROLL_STATUS_LABELS_SQ } from "../helpers/dashboard-labels";

/** Status pill tones tuned for the navy hero background. */
const DARK_PILL: Record<PayrollPeriodStatus, { chip: string; dot: string }> = {
  DRAFT: { chip: "bg-[rgba(245,158,11,0.16)] text-[#fbbf24]", dot: "bg-[#fbbf24]" },
  REVIEWED: { chip: "bg-[rgba(59,130,246,0.2)] text-[#93c5fd]", dot: "bg-[#60a5fa]" },
  APPROVED: { chip: "bg-[rgba(34,197,94,0.16)] text-[#4ade80]", dot: "bg-[#4ade80]" },
  LOCKED: { chip: "bg-white text-brand-navy", dot: "" },
  ARCHIVED: { chip: "bg-white/10 text-[#cbd5e1]", dot: "bg-[#94a3b8]" },
};

const STAGE_ORDER: PayrollPeriodStatus[] = ["DRAFT", "REVIEWED", "APPROVED", "LOCKED"];

/** Shared by the full hero and the folded strip, so the two never disagree. */
function StatusPill({ status }: { status: PayrollPeriodStatus | null }) {
  const pill = status ? DARK_PILL[status] : null;
  if (!status || !pill) {
    return (
      <span className="inline-flex h-[23px] items-center gap-1.5 whitespace-nowrap rounded-full bg-white/10 px-2.5 text-[11.5px] font-semibold text-[#cbd5e1]">
        <span className="h-1.5 w-1.5 rounded-full bg-[#94a3b8]" aria-hidden />
        Pa payroll
      </span>
    );
  }
  return (
    <span
      className={cn(
        "inline-flex h-[23px] items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 text-[11.5px] font-semibold",
        pill.chip,
      )}
    >
      {status === "LOCKED" ? (
        <Lock className="h-[11px] w-[11px]" strokeWidth={2.5} aria-hidden />
      ) : (
        <span className={cn("h-1.5 w-1.5 rounded-full", pill.dot)} aria-hidden />
      )}
      {PAYROLL_STATUS_LABELS_SQ[status]}
    </span>
  );
}

function continueLabel(status: PayrollPeriodStatus | null): string {
  return status === "LOCKED" || status === "ARCHIVED" ? "Shiko payroll-in" : "Vazhdo ciklin";
}

/**
 * The hero folded down to a strip: month, stage and the gross total. Enough to
 * know where the run stands without giving it a third of the screen — and still
 * server-rendered, so the figure is formatted exactly as everywhere else.
 */
export function DashboardPayrollCollapsedBar({ payroll }: { payroll: DashboardPayrollSlice }) {
  const hasPayroll = payroll.payrollId != null && payroll.status != null;
  return (
    <section
      aria-labelledby="dashboard-payroll-hero-title"
      className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl bg-brand-navy px-[18px] py-3 text-[#e8edf5] shadow-[0_1px_3px_rgba(15,23,42,0.05)]"
    >
      <h2
        id="dashboard-payroll-hero-title"
        className="text-[12px] font-semibold uppercase tracking-[0.05em] text-[#8b95a7]"
      >
        Cikli i pagës · {payrollMonthLabel(payroll.year, payroll.month)}
      </h2>
      <StatusPill status={payroll.status} />
      <p className="text-[15px] font-bold text-white tabular-nums">
        <MaskedAmount value={formatEur(payroll.totals.grossSalary)} />
        <span className="ml-1.5 text-[11.5px] font-normal text-[#8b95a7]">bruto</span>
      </p>
      <div className="ml-auto flex items-center gap-2">
        <Link
          href={hasPayroll ? `/pagat/${payroll.payrollId}` : "/pagat"}
          className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-[#8b95a7] transition-colors hover:text-white"
        >
          {continueLabel(payroll.status)}
          <ArrowRight className="h-3.5 w-3.5" aria-hidden />
        </Link>
        <PayrollHeroFoldToggle />
      </div>
    </section>
  );
}

function shortDate(iso: string | null): string | null {
  if (!iso) return null;
  return new Intl.DateTimeFormat("sq-AL", { day: "numeric", month: "short", timeZone: "UTC" }).format(
    new Date(iso),
  );
}

/**
 * The payroll run — the object this whole product exists to produce, so it leads
 * the page rather than sitting in a side rail.
 *
 * The stage rail is driven by the stored `reviewedAt` / `approvedAt` / `lockedAt`
 * timestamps instead of a hardcoded percentage, so it reports what actually
 * happened and when, not a guess derived from the current status.
 */
/**
 * Before a payroll exists there is nothing to report, so the hero collapses to a
 * single line rather than filling a screen with zeros and empty stage rails for
 * however long it takes someone to start the month.
 */
export function DashboardPayrollPrompt({
  year,
  month,
  atkDeadline,
}: {
  year: number;
  month: number;
  atkDeadline?: AtkDeadlineItem | null;
}) {
  return (
    <section
      aria-labelledby="dashboard-payroll-prompt-title"
      className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 rounded-xl border border-[#e2e8f0] bg-white px-[18px] py-3.5 shadow-[0_1px_3px_rgba(15,23,42,0.05)]"
    >
      <div className="min-w-0">
        <h2 id="dashboard-payroll-prompt-title" className="text-[14.5px] font-bold text-[#0f172a]">
          Ende s&apos;ka payroll për {payrollMonthLabel(year, month)}
        </h2>
        <p className="text-[12.5px] text-[#64748b]">
          {atkDeadline
            ? atkDeadline.detail
            : "Krijoni ciklin kur të jeni gati — deri atëherë nuk ka çfarë të raportohet."}
        </p>
      </div>
      <Link
        href="/pagat"
        className="inline-flex h-[38px] shrink-0 items-center gap-1.5 rounded-[9px] bg-brand-blue px-[18px] text-[13px] font-semibold text-white transition-colors hover:bg-[#1d4ed8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        Krijo payroll
        <ArrowRight className="h-4 w-4" aria-hidden />
      </Link>
    </section>
  );
}

export function DashboardPayrollPanel({
  payroll,
  metrics,
  activeEmployeeCount,
  atkDeadline,
}: {
  payroll: DashboardPayrollSlice;
  metrics: DashboardCostMetrics;
  activeEmployeeCount: number;
  atkDeadline?: AtkDeadlineItem | null;
}) {
  const label = payrollMonthLabel(payroll.year, payroll.month);
  const hasPayroll = payroll.payrollId != null && payroll.status != null;
  const employeesOutsideCycle = Math.max(0, activeEmployeeCount - payroll.employeeCount);

  const reachedIndex = payroll.status ? STAGE_ORDER.indexOf(payroll.status) : -1;
  // ARCHIVED sits past the rail; treat it as fully complete.
  const reached = payroll.status === "ARCHIVED" ? STAGE_ORDER.length - 1 : reachedIndex;

  const stampFor: Record<PayrollPeriodStatus, string | null> = {
    DRAFT: null,
    REVIEWED: shortDate(payroll.reviewedAtIso),
    APPROVED: shortDate(payroll.approvedAtIso),
    LOCKED: shortDate(payroll.lockedAtIso),
    ARCHIVED: null,
  };

  const mom = metrics.momEmployerCostPct;

  return (
    <section
      aria-labelledby="dashboard-payroll-hero-title"
      className="rounded-2xl bg-brand-navy p-[22px] text-[#e8edf5] shadow-[0_1px_3px_rgba(15,23,42,0.05)]"
    >
      <div className="mb-[18px] flex flex-wrap items-center justify-between gap-2">
        <h2
          id="dashboard-payroll-hero-title"
          className="text-[12px] font-semibold uppercase tracking-[0.05em] text-[#8b95a7]"
        >
          Cikli i pagës · {label}
        </h2>
        <div className="flex items-center gap-2">
          <StatusPill status={payroll.status} />
          <PayrollHeroFoldToggle />
        </div>
      </div>

      <div id="dashboard-payroll-hero-body" className="flex flex-wrap items-end gap-x-6 gap-y-2">
        <p className="text-[34px] font-extrabold leading-none tracking-[-0.03em] text-white tabular-nums">
          <MaskedAmount value={formatEur(payroll.totals.grossSalary)} />
        </p>
        {mom != null ? (
          <p
            className={cn(
              "text-[13px] font-semibold",
              mom > 0 ? "text-[#fbbf24]" : mom < 0 ? "text-[#4ade80]" : "text-[#8b95a7]",
            )}
          >
            {mom === 0 ? (
              "Pa ndryshim"
            ) : (
              <>
                {mom > 0 ? "▲" : "▼"} <span className="tabular-nums">{Math.abs(mom).toFixed(1)}%</span>
              </>
            )}
            <span className="ml-1 font-normal text-[#8b95a7]">kundrejt muajit të kaluar</span>
          </p>
        ) : null}
      </div>
      <p className="mt-1.5 text-[12.5px] text-[#8b95a7]">
        Bruto totale · {payroll.employeeCount} punonjës
      </p>
      {hasPayroll && employeesOutsideCycle > 0 ? (
        <p className="mt-1 text-[11.5px] text-[#cbd5e1]">
          {employeesOutsideCycle} pa u përfshirë në këtë cikël pagese
        </p>
      ) : null}

      <dl className="my-5 flex flex-wrap gap-x-[22px] gap-y-3">
        <div>
          <dt className="mb-0.5 text-[11.5px] text-[#8b95a7]">Neto</dt>
          <dd className="text-[16px] font-bold text-white tabular-nums">
            <MaskedAmount value={formatEur(payroll.totals.netPay)} />
          </dd>
        </div>
        <div>
          <dt className="mb-0.5 text-[11.5px] text-[#8b95a7]">Kosto punëdhënësi</dt>
          <dd className="text-[16px] font-bold text-white tabular-nums">
            <MaskedAmount value={formatEur(payroll.totals.employerTotalCost)} />
          </dd>
        </div>
        {metrics.ytd.months > 0 ? (
          <div>
            <dt className="mb-0.5 text-[11.5px] text-[#8b95a7]">
              Kosto {payroll.year} ({metrics.ytd.months} muaj)
            </dt>
            <dd className="text-[16px] font-bold text-white tabular-nums">
              <MaskedAmount value={formatEur(metrics.ytd.employerCost)} />
            </dd>
          </div>
        ) : null}
      </dl>

      <ol className="mb-4 flex items-stretch gap-1.5" aria-label="Ecuria e ciklit të pagës">
        {STAGE_ORDER.map((stage, idx) => {
          const done = reached >= idx && hasPayroll;
          const isCurrent = reached === idx && hasPayroll;
          const stamp = stampFor[stage];
          return (
            <li key={stage} className="min-w-0 flex-1">
              <div
                className={cn(
                  "h-[5px] rounded-full",
                  done ? "bg-brand-blue" : "bg-white/10",
                  isCurrent && "bg-white",
                )}
                aria-hidden
              />
              <p
                className={cn(
                  "mt-1.5 truncate text-[10.5px] font-semibold",
                  done ? "text-[#cbd5e1]" : "text-[#64748b]",
                )}
              >
                {PAYROLL_STATUS_LABELS_SQ[stage]}
              </p>
              {stamp ? (
                <p className="truncate text-[10px] text-[#64748b] tabular-nums">{stamp}</p>
              ) : null}
            </li>
          );
        })}
      </ol>

      {atkDeadline ? (
        <p
          className={cn(
            "mb-3 flex items-center gap-1.5 rounded-lg px-3 py-2 text-[12px]",
            atkDeadline.severity === "critical"
              ? "bg-[rgba(220,38,38,0.18)] text-[#fca5a5]"
              : atkDeadline.severity === "warning"
                ? "bg-[rgba(245,158,11,0.16)] text-[#fbbf24]"
                : "bg-white/[0.07] text-[#cbd5e1]",
          )}
        >
          <Clock className="h-3.5 w-3.5 shrink-0" aria-hidden />
          <span className="min-w-0">{atkDeadline.title}</span>
        </p>
      ) : null}

      <Link
        href={hasPayroll ? `/pagat/${payroll.payrollId}` : "/pagat"}
        className="flex h-[42px] w-full items-center justify-center rounded-[10px] bg-brand-blue text-[14px] font-semibold text-white transition-colors hover:bg-[#1d4ed8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
      >
        {hasPayroll ? (
          <>
            {payroll.status === "LOCKED" || payroll.status === "ARCHIVED"
              ? "Shiko payroll-in"
              : "Vazhdo ciklin"}
            <ArrowRight className="ml-1.5 h-4 w-4" aria-hidden />
          </>
        ) : (
          "Krijo payroll për muajin"
        )}
      </Link>

      <div className="mt-3 flex items-center justify-center gap-3 text-[12.5px] font-semibold">
        <Link href="/pagat" className="text-[#8b95a7] transition-colors hover:text-white">
          Të gjitha pagat
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
      <div className="mb-4 flex gap-1.5">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-[5px] flex-1 animate-pulse rounded-full bg-white/10" />
        ))}
      </div>
      <div className="mt-4 h-[42px] w-full animate-pulse rounded-[10px] bg-white/10" />
    </div>
  );
}
