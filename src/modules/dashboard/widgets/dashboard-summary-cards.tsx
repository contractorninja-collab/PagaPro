import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import type { DashboardSummaryCards } from "../types/dashboard-types";

type SummaryKey = keyof DashboardSummaryCards;
type SummaryDomain = "workforce" | "payroll" | "hr";

type SummaryItem = {
  key: SummaryKey;
  label: string;
  hint: string;
  href: string;
  cta: string;
  domain: SummaryDomain;
  actionWhenPositive?: boolean;
  actionPriority?: number;
};

const DOMAIN_LABELS: Array<{ key: SummaryDomain; label: string }> = [
  { key: "workforce", label: "Workforce" },
  { key: "payroll", label: "Payroll / Compliance" },
  { key: "hr", label: "HR events" },
];

const ITEMS: SummaryItem[] = [
  {
    key: "activeEmployees",
    label: "Aktiv punonjës",
    hint: "Statusi ACTIVE",
    href: "/punonjesit?status=ACTIVE",
    cta: "Shiko listën",
    domain: "workforce",
  },
  {
    key: "contractsExpiringWithin30Days",
    label: "Kontrata afër skadimit",
    hint: "Brenda 30 ditëve",
    href: "#contracts-expiry",
    cta: "Shiko kontratat",
    domain: "workforce",
    actionWhenPositive: true,
    actionPriority: 3,
  },
  {
    key: "payrollsInDraft",
    label: "Payroll në draft",
    hint: "Të gjitha periudhat",
    href: "/pagat?status=DRAFT",
    cta: "Hap pagat",
    domain: "payroll",
    actionWhenPositive: true,
    actionPriority: 1,
  },
  {
    key: "documentsGeneratedThisMonth",
    label: "Dokumente të gjeneruara",
    hint: "Final, muaji i filtrit",
    href: "/dokumentet",
    cta: "Shiko dokumentet",
    domain: "payroll",
  },
  {
    key: "leaveRequestsPending",
    label: "Pushime në pritje",
    hint: "Status PENDING",
    href: "#leave-requests",
    cta: "Aprovo tani",
    domain: "hr",
    actionWhenPositive: true,
    actionPriority: 2,
  },
  {
    key: "employeesTerminatedThisMonth",
    label: "Të larguar këtë muaj",
    hint: "Sipas datës së largimit",
    href: "/punonjesit?status=TERMINATED",
    cta: "Shiko listën",
    domain: "hr",
  },
];

function ActionCard({ item, value }: { item: SummaryItem; value: number }) {
  return (
    <Link
      href={item.href}
      className="group flex min-h-[104px] flex-col justify-between rounded-lg border border-[#fed7aa] border-l-4 border-l-[#f59e0b] bg-[#fffbeb] px-4 py-3.5 transition-colors hover:bg-[#fff7d6] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      aria-label={`${item.label}: ${value}. ${item.cta}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[12px] font-bold text-[#78350f]">{item.label}</p>
          <p className="mt-0.5 text-[10.5px] text-[#a16207]">{item.hint}</p>
        </div>
        <span className="text-[27px] font-extrabold leading-none text-[#b45309] tabular-nums">
          {value}
        </span>
      </div>
      <span className="mt-3 inline-flex items-center text-[11px] font-semibold text-[#92400e]">
        {item.cta}
        <ArrowRight
          className="ml-1 h-3 w-3 transition-transform group-hover:translate-x-0.5"
          aria-hidden
        />
      </span>
    </Link>
  );
}

function DomainMetric({ item, value }: { item: SummaryItem; value: number }) {
  const isZero = value === 0;

  return (
    <Link
      href={item.href}
      className={cn(
        "group flex min-h-11 items-center justify-between gap-3 border-b border-[#f1f5f9] px-1 py-2.5 last:border-b-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        isZero ? "text-[#94a3b8]" : "text-[#334155]",
      )}
      aria-label={`${item.label}: ${value}. ${item.cta}`}
    >
      <div className="min-w-0">
        <p className={cn("truncate text-[11.5px] font-semibold", isZero && "font-medium")}>
          {item.label}
        </p>
        <p className="truncate text-[10px] text-[#94a3b8]">{item.hint}</p>
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        <span
          className={cn(
            "text-[17px] font-bold tabular-nums",
            isZero && "text-[14px] font-semibold",
          )}
        >
          {value}
        </span>
        <ArrowRight
          className="h-3 w-3 opacity-0 transition-opacity group-hover:opacity-100"
          aria-hidden
        />
      </div>
    </Link>
  );
}

export function DashboardKpiCards({ summary }: { summary: DashboardSummaryCards }) {
  const actionItems = ITEMS.filter(
    (item) => item.actionWhenPositive && summary[item.key] > 0,
  ).sort((a, b) => (a.actionPriority ?? 99) - (b.actionPriority ?? 99));
  const actionKeys = new Set(actionItems.map((item) => item.key));

  return (
    <section aria-label="Përmbledhje operative" className="space-y-4">
      {actionItems.length > 0 ? (
        <div>
          <p className="mb-2 text-[10.5px] font-bold uppercase text-[#b45309]">Kërkon veprim</p>
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
            {actionItems.map((item) => (
              <ActionCard key={item.key} item={item} value={summary[item.key]} />
            ))}
          </div>
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-x-5 gap-y-3 sm:grid-cols-3 lg:grid-cols-1">
        {DOMAIN_LABELS.map((domain) => {
          const domainItems = ITEMS.filter(
            (item) => item.domain === domain.key && !actionKeys.has(item.key),
          );
          if (domainItems.length === 0) return null;

          return (
            <section key={domain.key} aria-labelledby={`dashboard-domain-${domain.key}`}>
              <h3
                id={`dashboard-domain-${domain.key}`}
                className="border-b border-[#e2e8f0] pb-1.5 text-[10.5px] font-bold uppercase text-[#64748b]"
              >
                {domain.label}
              </h3>
              <div>
                {domainItems.map((item) => (
                  <DomainMetric key={item.key} item={item} value={summary[item.key]} />
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </section>
  );
}

export function DashboardKpiCardsSkeleton() {
  return (
    <div className="space-y-4" aria-hidden>
      <div>
        <Skeleton className="mb-2 h-3 w-24" />
        <Skeleton className="h-[104px] w-full rounded-lg" />
      </div>
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i}>
          <Skeleton className="mb-2 h-3 w-28" />
          <Skeleton className="h-11 w-full" />
          <Skeleton className="mt-1 h-11 w-full" />
        </div>
      ))}
    </div>
  );
}

export function DashboardSummaryCardsGrid({ summary }: { summary: DashboardSummaryCards }) {
  return <DashboardKpiCards summary={summary} />;
}

export function DashboardSummaryCardsSkeleton() {
  return <DashboardKpiCardsSkeleton />;
}
