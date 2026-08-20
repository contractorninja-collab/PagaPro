"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { AlertCircle, AlertTriangle, Bell, CheckCircle2, ChevronRight, Info, RefreshCw } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { fetchAlertsAction } from "@/modules/dashboard/actions/alerts-action";
import type { OperationalAlert } from "@/modules/dashboard/types/dashboard-types";

/**
 * The notification bell. Alerts here are DERIVED state — deadlines, expiries,
 * drafts — recomputed on every open, so there is no fake "mark as read" that
 * un-reads itself on the next visit: a row disappears when the underlying
 * issue is resolved, and the whole row is the action that takes you there.
 */

const SEVERITY_ORDER: Record<OperationalAlert["severity"], number> = {
  critical: 0,
  warning: 1,
  info: 2,
};

const SEVERITY_STYLE: Record<
  OperationalAlert["severity"],
  { icon: typeof Info; iconColor: string; rail: string; label: string }
> = {
  critical: { icon: AlertCircle, iconColor: "text-tone-danger-fg", rail: "bg-tone-danger-fg", label: "Kritike" },
  warning: { icon: AlertTriangle, iconColor: "text-tone-warning-dot", rail: "bg-tone-warning-dot", label: "Vëmendje" },
  info: { icon: Info, iconColor: "text-brand-blue", rail: "bg-brand-blue", label: "Informacion" },
};

function AlertRow({ alert, onNavigate }: { alert: OperationalAlert; onNavigate: () => void }) {
  const s = SEVERITY_STYLE[alert.severity];
  const Icon = s.icon;
  const body = (
    <span className="flex min-w-0 flex-1 items-start gap-3">
      <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", s.iconColor)} aria-hidden />
      <span className="min-w-0">
        <span className="block text-[13px] font-semibold leading-snug text-ink-900">{alert.title}</span>
        {alert.detail ? (
          <span className="mt-0.5 block text-[12px] leading-relaxed text-ink-500">{alert.detail}</span>
        ) : null}
        {alert.actionLabel && alert.href ? (
          <span className="mt-1 block text-[12px] font-semibold text-brand-blue">{alert.actionLabel}</span>
        ) : null}
      </span>
    </span>
  );

  const shell = cn(
    "group relative flex w-full items-start gap-2 py-3 pl-5 pr-3 text-left transition-colors",
    alert.href ? "hover:bg-fill-faint focus-visible:bg-fill-faint" : "",
    "focus-visible:outline-none",
  );
  const rail = <span className={cn("absolute bottom-2 left-2 top-2 w-[3px] rounded-full", s.rail)} aria-hidden />;

  if (!alert.href) {
    return (
      <li className="relative">
        <div className={shell}>
          {rail}
          {body}
        </div>
      </li>
    );
  }
  return (
    <li className="relative">
      <Link href={alert.href} onClick={onNavigate} className={shell}>
        {rail}
        {body}
        <ChevronRight
          className="mt-1 h-4 w-4 shrink-0 text-ink-300 transition-transform group-hover:translate-x-0.5 group-hover:text-ink-500"
          aria-hidden
        />
      </Link>
    </li>
  );
}

function LoadingRows() {
  return (
    <ul className="divide-y divide-fill" aria-hidden>
      {Array.from({ length: 3 }).map((_, i) => (
        <li key={i} className="animate-pulse space-y-2 py-3 pl-5 pr-3">
          <div className="h-3.5 w-3/4 rounded bg-fill" />
          <div className="h-3 w-full rounded bg-fill" />
        </li>
      ))}
    </ul>
  );
}

export function AlertsSheet({
  initialCount,
  variant = "default",
}: {
  initialCount: number;
  /** "topnav" renders the dark 36px square trigger with a numeric count badge (1b shell). */
  variant?: "default" | "topnav";
}) {
  const [open, setOpen] = useState(false);
  const [alerts, setAlerts] = useState<OperationalAlert[]>([]);
  const [count, setCount] = useState(initialCount);
  const [isPending, startTransition] = useTransition();

  function refresh() {
    startTransition(async () => {
      const data = await fetchAlertsAction();
      data.sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);
      setAlerts(data);
      setCount(data.length);
    });
  }

  function handleOpen() {
    setOpen(true);
    refresh();
  }

  const critical = alerts.filter((a) => a.severity === "critical").length;

  return (
    <>
      {variant === "topnav" ? (
        <button
          type="button"
          aria-label={`Njoftime${count > 0 ? ` — ${count} aktive` : ""}`}
          aria-expanded={open}
          onClick={handleOpen}
          className="relative flex h-9 w-9 items-center justify-center rounded-[9px] bg-white/[0.07] text-slate-300 transition-colors hover:bg-white/[0.12] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
        >
          <Bell className="h-4 w-4" />
          {count > 0 && (
            <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full border-2 border-brand-navy bg-tone-danger-fg px-1 text-[9.5px] font-bold leading-none text-white">
              {count > 99 ? "99+" : count}
            </span>
          )}
        </button>
      ) : (
        <button
          type="button"
          aria-label={`Njoftime${count > 0 ? ` — ${count} aktive` : ""}`}
          aria-expanded={open}
          onClick={handleOpen}
          className="relative flex h-9 w-9 items-center justify-center rounded-[9px] text-ink-500 transition-colors hover:bg-fill-hover hover:text-ink-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue/40"
        >
          <Bell className="h-5 w-5" />
          {count > 0 && (
            <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-tone-danger-fg" aria-hidden />
          )}
        </button>
      )}

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-sm">
          <SheetHeader className="border-b border-line px-5 py-3.5">
            <div className="flex items-center justify-between gap-2 pr-8">
              <SheetTitle className="flex items-baseline gap-2 text-[15px] font-bold tracking-[-0.01em] text-ink-900">
                Njoftimet
                {!isPending && alerts.length > 0 ? (
                  <span className="text-[12px] font-semibold text-ink-400">
                    {alerts.length}
                    {critical > 0 ? ` · ${critical} kritike` : ""}
                  </span>
                ) : null}
              </SheetTitle>
              <button
                type="button"
                aria-label="Rifresko njoftimet"
                onClick={refresh}
                disabled={isPending}
                className="flex h-7 w-7 items-center justify-center rounded-[7px] text-ink-400 transition-colors hover:bg-fill-hover hover:text-ink-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue/40 disabled:opacity-50"
              >
                <RefreshCw className={cn("h-3.5 w-3.5", isPending && "animate-spin")} aria-hidden />
              </button>
            </div>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto">
            {isPending && alerts.length === 0 ? (
              <LoadingRows />
            ) : alerts.length === 0 ? (
              <div className="flex flex-col items-center gap-2 px-6 py-14 text-center">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-tone-success-bg">
                  <CheckCircle2 className="h-5 w-5 text-tone-success-fg" aria-hidden />
                </span>
                <p className="text-[13.5px] font-semibold text-ink-900">Gjithçka në rregull</p>
                <p className="text-[12.5px] leading-relaxed text-ink-500">
                  Asnjë afat, skadencë apo draft nuk kërkon vëmendje tani. Njoftimet
                  rifreskohen sa herë hapet kambana.
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-fill">
                {alerts.map((alert) => (
                  <AlertRow key={alert.id} alert={alert} onNavigate={() => setOpen(false)} />
                ))}
              </ul>
            )}
          </div>

          <div className="border-t border-line bg-fill-faint px-5 py-3">
            <Link
              href="/paneli"
              onClick={() => setOpen(false)}
              className="text-[12.5px] font-semibold text-brand-blue hover:underline"
            >
              Hap qendrën e veprimeve →
            </Link>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
