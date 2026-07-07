import Link from "next/link";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import type { DashboardSummaryCards } from "../types/dashboard-types";

const LABELS: {
  key: keyof DashboardSummaryCards;
  label: string;
  hint: string;
  href: string;
  cta: string;
}[] = [
  {
    key: "activeEmployees",
    label: "Aktiv punonjës",
    hint: "Statusi ACTIVE",
    href: "/punonjesit?status=ACTIVE",
    cta: "Shiko listën →",
  },
  {
    key: "contractsExpiringWithin30Days",
    label: "Kontrata afër skadimit",
    hint: "brenda 30 ditëve",
    href: "#contracts-expiry",
    cta: "Shiko kontratat →",
  },
  {
    key: "payrollsInDraft",
    label: "Payroll në draft",
    hint: "të gjitha periudhat",
    href: "/pagat?status=DRAFT",
    cta: "Hap pagat →",
  },
  {
    key: "leaveRequestsPending",
    label: "Pushime në pritje",
    hint: "status PENDING",
    href: "#leave-requests",
    cta: "Aprovo tani →",
  },
  {
    key: "documentsGeneratedThisMonth",
    label: "Dokumente të gjeneruara",
    hint: "final, muaji i filtrit",
    href: "/dokumentet",
    cta: "Shiko dokumentet →",
  },
  {
    key: "employeesTerminatedThisMonth",
    label: "Të larguar këtë muaj",
    hint: "sipas datës së largimit",
    href: "/punonjesit?status=TERMINATED",
    cta: "Shiko listën →",
  },
];

export function DashboardKpiCard(props: {
  label: string;
  hint: string;
  value: number;
  href: string;
  cta: string;
  emphasis?: boolean;
  attentionWhenPositive?: boolean;
  className?: string;
}) {
  const needsAttention = props.attentionWhenPositive && props.value > 0;

  return (
    <Link
      href={props.href}
      className={cn(
        "group surface-card-padded flex h-full min-h-[120px] flex-col justify-between transition-colors hover:bg-[#f8fafc] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        props.emphasis && "border-blue-200/80 bg-gradient-to-br from-blue-50/50 via-white to-white hover:from-blue-50/70",
        props.className,
      )}
    >
      <div>
        <p className={cn("card-label", props.emphasis && "text-blue-800/70")}>{props.label}</p>
        <p className="mt-1 text-xs text-muted-foreground">{props.hint}</p>
      </div>
      <div className="mt-3 flex items-end justify-between gap-3">
        <p className={cn("card-value", needsAttention && "text-amber-700")}>{props.value}</p>
        <span className="shrink-0 text-xs font-semibold text-[#64748b] transition-colors group-hover:text-[#0f172a]">
          {props.cta}
        </span>
      </div>
    </Link>
  );
}

export function DashboardKpiCards({ summary }: { summary: DashboardSummaryCards }) {
  return (
    <>
      {LABELS.map(({ key, label, hint, href, cta }) => (
        <DashboardKpiCard
          key={key}
          className="card-sm"
          label={label}
          hint={hint}
          href={href}
          cta={cta}
          value={summary[key]}
          emphasis={key === "payrollsInDraft"}
          attentionWhenPositive={
            key === "payrollsInDraft" ||
            key === "leaveRequestsPending" ||
            key === "contractsExpiringWithin30Days"
          }
        />
      ))}
    </>
  );
}

export function DashboardKpiCardsSkeleton() {
  return (
    <>
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="card-sm surface-card-padded min-h-[120px]">
          <Skeleton className="mb-4 h-3 w-28" />
          <Skeleton className="h-8 w-12" />
        </div>
      ))}
    </>
  );
}

export function DashboardSummaryCardsGrid({ summary }: { summary: DashboardSummaryCards }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3" aria-label="Përmbledhje operative">
      {LABELS.map(({ key, label, hint, href, cta }) => (
        <Link
          key={key}
          href={href}
          className={cn(
            "group block rounded-lg border border-border/80 bg-card transition-shadow",
            "hover:border-border hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          )}
          aria-label={`${label}: ${summary[key]}. ${cta}`}
        >
          <div className="px-5 pb-4 pt-5">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {label}
            </p>
            <p className="mt-0.5 text-[11px] text-muted-foreground/70">{hint}</p>
            <p className="mt-3 text-3xl font-semibold tabular-nums text-foreground">
              {summary[key]}
            </p>
            <p className="mt-2 text-[11px] font-medium text-muted-foreground transition-colors group-hover:text-foreground">
              {cta}
            </p>
          </div>
        </Link>
      ))}
    </div>
  );
}

export function DashboardSummaryCardsSkeleton() {
  return (
    <div className="dashboard-grid">
      <DashboardKpiCardsSkeleton />
    </div>
  );
}
