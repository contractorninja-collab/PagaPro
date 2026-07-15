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
    <div className="flex h-full flex-col overflow-hidden rounded-xl border border-[#e2e8f0] bg-white shadow-[0_1px_3px_rgba(15,23,42,0.05)]">
      <div className="border-b border-[#f1f5f9] px-5 pb-3.5 pt-[18px]">
        <h3 className="text-[15px] font-bold text-[#0f172a]">Aktiviteti i fundit</h3>
        <p className="mt-0.5 text-[12px] text-[#94a3b8]">
          Ngjarje operative nga auditimi dhe timeline-i.
        </p>
      </div>

      {entries.length === 0 ? (
        <p className="px-5 py-8 text-center text-sm text-[#64748b]">
          Ende nuk ka ngjarje të regjistruara për këtë kompani.
        </p>
      ) : (
        <ul className="divide-y divide-[#f1f5f9]">
          {entries.map((e) => (
            <li key={e.id} className="px-5 py-3 transition-colors hover:bg-[#f8fafc]">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="text-[13.5px] font-semibold leading-snug text-[#0f172a]">
                    {e.title}
                  </p>
                  {e.subtitle ? (
                    <p className="break-words text-[12px] text-[#64748b]">{e.subtitle}</p>
                  ) : null}
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <span className="inline-flex h-[19px] items-center rounded-full bg-[#f1f5f9] px-2 text-[10.5px] font-semibold text-[#64748b]">
                      {SOURCE_LABELS[e.source]}
                    </span>
                    {e.actorLabel ? (
                      <span className="text-[11px] text-[#94a3b8]">nga {e.actorLabel}</span>
                    ) : null}
                  </div>
                </div>
                <time
                  className="shrink-0 text-[11px] tabular-nums text-[#94a3b8]"
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
