import { Badge } from "@/components/ui/badge";
import { formatSqDate } from "@/modules/employees/components/employees-labels";
import type { TimelineEntryDto } from "../types/dashboard-types";

const SOURCE_LABELS: Record<TimelineEntryDto["source"], string> = {
  domain: "Aktivitet",
  employee_timeline: "HR",
  audit: "Audit",
  document_timeline: "Dokument",
};

export function DashboardActivityTimeline({ entries }: { entries: TimelineEntryDto[] }) {
  return (
    <div className="rounded-lg border border-border/80 bg-card">
      <div className="border-b border-border/60 px-4 py-3">
        <h2 className="text-sm font-semibold text-foreground">Aktiviteti i fundit</h2>
        <p className="text-xs text-muted-foreground">Ngjarje operative nga auditimi dhe timeline-i.</p>
      </div>
      {entries.length === 0 ? (
        <p className="px-4 py-8 text-center text-sm text-muted-foreground">
          Ende nuk ka ngjarje të regjistruara për këtë kompani.
        </p>
      ) : (
        <ul className="divide-y divide-border/60">
          {entries.map((e) => (
            <li key={e.id} className="px-4 py-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="text-sm font-medium leading-snug text-foreground">{e.title}</p>
                  {e.subtitle ? (
                    <p className="break-words text-xs text-muted-foreground">{e.subtitle}</p>
                  ) : null}
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <Badge variant="secondary" className="text-[10px] font-normal">
                      {SOURCE_LABELS[e.source]}
                    </Badge>
                    {e.actorLabel ? (
                      <span className="text-[11px] text-muted-foreground">nga {e.actorLabel}</span>
                    ) : null}
                  </div>
                </div>
                <time
                  className="shrink-0 text-[11px] tabular-nums text-muted-foreground"
                  dateTime={e.occurredAtIso}
                >
                  {formatSqDate(e.occurredAtIso)}{" "}
                  {new Date(e.occurredAtIso).toLocaleTimeString("sq-AL", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </time>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
