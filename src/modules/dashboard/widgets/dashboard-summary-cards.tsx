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
        "group flex h-full flex-col rounded-xl border border-[#e2e8f0] bg-white px-4 py-3.5 shadow-[0_1px_3px_rgba(15,23,42,0.05)] transition-colors hover:bg-[#f8fafc] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        props.emphasis && "border-[#bfdbfe]",
        props.className,
      )}
    >
      <p className="text-[11.5px] font-semibold leading-snug text-[#64748b]">{props.label}</p>
      <p className="mt-0.5 truncate text-[10.5px] text-[#94a3b8]">{props.hint}</p>
      <p
        className={cn(
          "mt-2 text-[26px] font-extrabold leading-none tracking-[-0.02em] tabular-nums",
          needsAttention ? "text-[#b45309]" : "text-[#0f172a]",
        )}
      >
        {props.value}
      </p>
      <p className="mt-2 truncate text-[11px] font-semibold text-[#94a3b8] transition-colors group-hover:text-brand-blue">
        {props.cta}
      </p>
    </Link>
  );
}

export function DashboardKpiCards({ summary }: { summary: DashboardSummaryCards }) {
  return (
    <>
      {LABELS.map(({ key, label, hint, href, cta }) => (
        <DashboardKpiCard
          key={key}
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
        <div key={i} className="rounded-xl border border-[#e2e8f0] bg-white px-4 py-3.5">
          <Skeleton className="mb-3 h-3 w-24" />
          <Skeleton className="h-7 w-12" />
          <Skeleton className="mt-3 h-3 w-20" />
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
