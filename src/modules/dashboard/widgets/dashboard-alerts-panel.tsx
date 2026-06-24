import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import type { OperationalAlert } from "../types/dashboard-types";

function severityStyles(s: OperationalAlert["severity"]) {
  switch (s) {
    case "critical":
      return "border-red-200 bg-red-50 text-red-950";
    case "warning":
      return "border-amber-200 bg-amber-50 text-amber-950";
    default:
      return "border-sky-200 bg-sky-50 text-sky-950";
  }
}

export function DashboardAlertsPanel({ alerts }: { alerts: OperationalAlert[] }) {
  return (
    <div className="rounded-lg border border-border/80 bg-card">
      <div className="border-b border-border/60 px-4 py-3">
        <h2 className="text-sm font-semibold text-foreground">Sinjalizime operative</h2>
        <p className="text-xs text-muted-foreground">Prioritete për veprim — të gjitha nga të dhënat aktuale.</p>
      </div>
      {alerts.length === 0 ? (
        <p className="px-4 py-8 text-center text-sm text-muted-foreground">
          Nuk ka alarme për momentin.
        </p>
      ) : (
        <ul className="divide-y divide-border/60">
          {alerts.map((a) => (
            <li key={a.id} className="px-4 py-3">
              <div className={`rounded-md border px-3 py-2 ${severityStyles(a.severity)}`}>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className="border-current bg-transparent text-[10px] uppercase">
                    {a.severity === "critical"
                      ? "Kritike"
                      : a.severity === "warning"
                        ? "Vëmendje"
                        : "Info"}
                  </Badge>
                  <p className="text-sm font-medium">{a.title}</p>
                </div>
                {a.detail ? <p className="mt-1 text-xs opacity-90">{a.detail}</p> : null}
                {a.href ? (
                  <Link href={a.href} className="mt-2 inline-block text-xs font-semibold underline">
                    Hap
                  </Link>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
