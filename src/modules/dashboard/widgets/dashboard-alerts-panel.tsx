import Link from "next/link";
import { AlertCircle, AlertTriangle, Info } from "lucide-react";
import { PanelHeader } from "@/components/patterns/page-header";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { OperationalAlert } from "../types/dashboard-types";

function severityIcon(severity: OperationalAlert["severity"]) {
  switch (severity) {
    case "critical":
      return AlertCircle;
    case "warning":
      return AlertTriangle;
    default:
      return Info;
  }
}

function severityAccent(severity: OperationalAlert["severity"]) {
  switch (severity) {
    case "critical":
      return {
        icon: "text-red-600",
        border: "border-l-red-500",
      };
    case "warning":
      return {
        icon: "text-amber-600",
        border: "border-l-amber-500",
      };
    default:
      return {
        icon: "text-sky-600",
        border: "border-l-sky-500",
      };
  }
}

function OperationalAlertRow({ alert }: { alert: OperationalAlert }) {
  const Icon = severityIcon(alert.severity);
  const accent = severityAccent(alert.severity);
  const ctaLabel = alert.actionLabel ?? "Shiko detajet";

  return (
    <li
      className={cn(
        "flex flex-col gap-3 rounded-lg border border-[#e2e8f0] border-l-4 bg-white px-4 py-3 shadow-[0_1px_2px_rgba(15,23,42,0.04)] sm:flex-row sm:items-center sm:justify-between",
        accent.border,
      )}
    >
      <div className="flex min-w-0 gap-3">
        <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", accent.icon)} aria-hidden />
        <div className="min-w-0 space-y-1">
          <p className="text-sm font-semibold leading-snug text-foreground">{alert.title}</p>
          {alert.detail ? (
            <p className="text-xs leading-relaxed text-muted-foreground">{alert.detail}</p>
          ) : null}
        </div>
      </div>

      {alert.href ? (
        <Button size="sm" variant="outlinePrimary" className="w-full shrink-0 sm:w-auto" asChild>
          <Link href={alert.href}>{ctaLabel}</Link>
        </Button>
      ) : null}
    </li>
  );
}

export function DashboardAlertsPanelSkeleton() {
  return (
    <div className="surface-card min-h-[180px]">
      <div className="card-header px-5 pt-5">
        <div className="h-4 w-36 rounded bg-muted" />
      </div>
      <div className="surface-card-body space-y-3">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="rounded-lg border border-[#e2e8f0] p-4">
            <div className="mb-2 h-4 w-3/4 rounded bg-muted" />
            <div className="h-3 w-full rounded bg-muted" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function DashboardAlertsPanel(props: {
  alerts: OperationalAlert[];
  showHeader?: boolean;
}) {
  const { alerts, showHeader = true } = props;

  return (
    <div className={cn("surface-card flex h-full flex-col", !showHeader && "border-0 bg-transparent shadow-none")}>
      {showHeader ? (
        <PanelHeader title="Kërkon vëmendjen" />
      ) : null}

      {alerts.length === 0 ? (
        <p className={cn("text-sm text-muted-foreground", showHeader ? "surface-card-body py-6" : "py-6")}>
          Nuk ka çështje që kërkojnë vëmendje për momentin.
        </p>
      ) : (
        <ul className={cn("flex-1 space-y-2", showHeader ? "surface-card-body" : "px-5 pb-5 pt-2")}>
          {alerts.map((alert) => (
            <OperationalAlertRow key={alert.id} alert={alert} />
          ))}
        </ul>
      )}
    </div>
  );
}
