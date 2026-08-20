import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { formatEur } from "@/modules/employees/components/employees-labels";
import { MaskedAmount } from "@/modules/employees/components/salary-visibility";
import type { DashboardSummaryCards, WorkforceMovementPointDto } from "../types/dashboard-types";
import type { DashboardCostMetrics } from "../services/dashboard-metrics-service";

/**
 * The four figures a payroll owner checks first — each shown with the comparison
 * that makes it mean something.
 *
 * The previous version printed six bare counts and repeated the pending-leave and
 * expiring-contract numbers that the action queue already lists, so the same work
 * appeared twice on one screen. Those two live in the queue now; this row answers
 * "how are we doing", not "what must I click".
 */

type Tone = "neutral" | "up" | "down";

function Delta({ text, tone }: { text: string; tone: Tone }) {
  return (
    <p
      className={cn(
        "mt-1 text-[11.5px] font-medium",
        tone === "up" ? "text-[#b45309]" : tone === "down" ? "text-[#15803d]" : "text-ink-400",
      )}
    >
      {text}
    </p>
  );
}

function Tile({
  label,
  value,
  delta,
  href,
  hint,
}: {
  label: string;
  value: React.ReactNode;
  delta?: { text: string; tone: Tone };
  href?: string;
  hint?: string;
}) {
  const body = (
    <>
      <p className="text-[11px] font-bold uppercase tracking-[0.04em] text-ink-400">{label}</p>
      <p className="mt-1.5 text-[22px] font-extrabold leading-none tracking-[-0.02em] text-brand-navy tabular-nums">
        {value}
      </p>
      {delta ? <Delta text={delta.text} tone={delta.tone} /> : null}
      {hint ? <p className="mt-1 text-[11.5px] text-ink-400">{hint}</p> : null}
    </>
  );

  const base =
    "flex min-h-[104px] flex-col justify-center rounded-xl border border-line bg-white px-4 py-3.5 shadow-card";

  if (!href) return <div className={base}>{body}</div>;

  return (
    <Link
      href={href}
      className={cn(
        base,
        "group transition-colors hover:border-ink-300 hover:bg-fill-faint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
      )}
    >
      {body}
      <span className="mt-2 inline-flex items-center text-[11px] font-semibold text-brand-blue">
        Hap
        <ArrowRight
          className="ml-1 h-3 w-3 transition-transform group-hover:translate-x-0.5"
          aria-hidden
        />
      </span>
    </Link>
  );
}

export function DashboardKpiCards({
  summary,
  metrics,
  movement,
  month,
  layout = "rail",
}: {
  summary: DashboardSummaryCards;
  metrics: DashboardCostMetrics;
  movement: WorkforceMovementPointDto[];
  month: number;
  /** "rail" sits beside the payroll hero; "wide" spans the page when the hero is collapsed. */
  layout?: "rail" | "wide";
}) {
  const mom = metrics.momEmployerCostPct;
  const employerCost = metrics.current?.employerCost ?? null;
  // `movement` is the twelve months of the filtered year, zero-filled and in order.
  const thisMonthMovement = movement[month - 1] ?? null;

  return (
    // Two across in the rail: it is ~360px wide, and four columns there turns
    // every label into a three-line wrap.
    <section
      aria-label="Treguesit kryesorë"
      className={cn("grid gap-3", layout === "wide" ? "grid-cols-2 lg:grid-cols-4" : "grid-cols-2")}
    >
      <Tile
        label="Kosto e punëdhënësit"
        value={
          employerCost != null ? (
            <MaskedAmount value={formatEur(employerCost)} />
          ) : (
            <span className="text-ink-300">—</span>
          )
        }
        delta={
          mom != null
            ? {
                text:
                  mom === 0
                    ? "Pa ndryshim kundrejt muajit të kaluar"
                    : `${mom > 0 ? "+" : ""}${mom.toFixed(1)}% kundrejt muajit të kaluar`,
                tone: mom > 0 ? "up" : mom < 0 ? "down" : "neutral",
              }
            : { text: "Pa muaj krahasues ende", tone: "neutral" }
        }
      />

      <Tile
        label="Punonjës aktivë"
        value={summary.activeEmployees}
        delta={
          thisMonthMovement && (thisMonthMovement.joiners > 0 || thisMonthMovement.leavers > 0)
            ? {
                text: `+${thisMonthMovement.joiners} të rinj · −${thisMonthMovement.leavers} largime këtë muaj`,
                tone: thisMonthMovement.net < 0 ? "up" : "neutral",
              }
            : { text: "Pa lëvizje këtë muaj", tone: "neutral" }
        }
        href="/punonjesit?status=ACTIVE"
      />

      <Tile
        label="Kosto mesatare / punonjës"
        value={
          metrics.averageEmployerCostPerEmployee != null ? (
            <MaskedAmount value={formatEur(metrics.averageEmployerCostPerEmployee)} />
          ) : (
            <span className="text-ink-300">—</span>
          )
        }
        hint={
          metrics.current != null
            ? `${metrics.current.employees} punonjës në pagë`
            : "Pa pagë për këtë muaj"
        }
      />

      <Tile
        label="Kosto vjetore deri tani"
        value={
          metrics.ytd.months > 0 ? (
            <MaskedAmount value={formatEur(metrics.ytd.employerCost)} />
          ) : (
            <span className="text-ink-300">—</span>
          )
        }
        hint={
          metrics.ytd.months > 0
            ? `${metrics.ytd.months} muaj të finalizuar`
            : "Asnjë muaj i finalizuar"
        }
        href="/raportet"
      />
    </section>
  );
}

export function DashboardKpiCardsSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-3" aria-hidden>
      {Array.from({ length: 4 }).map((_, i) => (
        <Skeleton key={i} className="h-[104px] w-full rounded-xl" />
      ))}
    </div>
  );
}
