"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { formatSqDate } from "@/modules/employees/components/employees-labels";
import type { TimelineEntryDto } from "../types/dashboard-types";

type ActivityFilter = "all" | "audit" | "activity" | "hr";

const FILTERS: Array<{ key: ActivityFilter; label: string }> = [
  { key: "all", label: "Të gjitha" },
  { key: "audit", label: "Audit" },
  { key: "activity", label: "Aktivitet" },
  { key: "hr", label: "HR" },
];

const SOURCE_CATEGORY: Record<TimelineEntryDto["source"], Exclude<ActivityFilter, "all">> = {
  domain: "activity",
  employee_timeline: "hr",
  audit: "audit",
  document_timeline: "activity",
};

const CATEGORY_LABELS: Record<Exclude<ActivityFilter, "all">, string> = {
  activity: "Aktivitet",
  hr: "HR",
  audit: "Audit",
};

const CATEGORY_STYLES: Record<Exclude<ActivityFilter, "all">, string> = {
  activity: "bg-[#eff6ff] text-[#1d4ed8]",
  hr: "bg-[#ecfdf5] text-[#047857]",
  audit: "bg-fill text-ink-600",
};

/**
 * The service collapses and returns thirty entries; showing nine of them meant
 * two thirds of the payload was fetched and dropped on every load. Fourteen is
 * what fits the card beside the other bands without turning it into a log file.
 */
const VISIBLE_ENTRY_LIMIT = 14;

export function ActivityLogCard({ entries }: { entries: TimelineEntryDto[] }) {
  const [filter, setFilter] = useState<ActivityFilter>("all");
  const matching = entries.filter(
    (entry) => filter === "all" || SOURCE_CATEGORY[entry.source] === filter,
  );
  const matchingCount = matching.length;
  const filteredEntries = matching.slice(0, VISIBLE_ENTRY_LIMIT);
  const hiddenCount = matchingCount - filteredEntries.length;

  return (
    <section
      id="activity-log"
      className="overflow-hidden rounded-lg border border-line bg-white shadow-card"
      aria-labelledby="activity-log-title"
    >
      <div className="border-b border-fill px-5 pb-4 pt-[18px]">
        <h3 id="activity-log-title" className="text-[15px] font-bold text-ink-900">
          Aktiviteti i fundit
        </h3>
        <p className="mt-0.5 text-[12px] text-ink-400">
          Veprimet më të fundit operative, të auditimit dhe HR.
        </p>

        <div
          className="mt-3 inline-flex max-w-full overflow-x-auto rounded-md border border-line bg-fill-faint p-0.5"
          role="group"
          aria-label="Filtro aktivitetin"
        >
          {FILTERS.map((option) => (
            <button
              key={option.key}
              type="button"
              aria-pressed={filter === option.key}
              onClick={() => setFilter(option.key)}
              className={cn(
                "h-8 whitespace-nowrap rounded px-3 text-[11.5px] font-semibold transition-colors",
                filter === option.key
                  ? "bg-white text-ink-900 shadow-sm"
                  : "text-ink-500 hover:text-ink-900",
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {filteredEntries.length === 0 ? (
        <p className="px-5 py-8 text-center text-sm text-ink-500">
          Nuk ka ngjarje për këtë filtër.
        </p>
      ) : (
        <ul className="divide-y divide-fill">
          {filteredEntries.map((entry) => {
            const category = SOURCE_CATEGORY[entry.source];
            return (
              <li key={entry.id} className="px-5 py-3 transition-colors hover:bg-fill-faint">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-semibold leading-snug text-ink-900">
                      {entry.title}
                    </p>
                    {entry.subtitle ? (
                      <p className="mt-0.5 break-words text-[11.5px] text-ink-500">
                        {entry.subtitle}
                      </p>
                    ) : null}
                    <div className="mt-1.5 flex flex-wrap items-center gap-2">
                      <span
                        className={cn(
                          "inline-flex h-[19px] items-center rounded px-2 text-[10.5px] font-semibold",
                          CATEGORY_STYLES[category],
                        )}
                      >
                        {CATEGORY_LABELS[category]}
                      </span>
                      {entry.actorLabel ? (
                        <span className="text-[11px] text-ink-400">
                          nga {entry.actorLabel}
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <time
                    className="shrink-0 text-[11px] tabular-nums text-ink-400"
                    dateTime={entry.occurredAtIso}
                  >
                    {formatSqDate(entry.occurredAtIso)}{" "}
                    {new Date(entry.occurredAtIso).toLocaleTimeString("sq-AL", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </time>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {hiddenCount > 0 ? (
        <p className="border-t border-fill px-5 py-3 text-[12px] text-ink-400">
          Po shfaqen {filteredEntries.length} nga {matchingCount} veprimet e fundit.
        </p>
      ) : null}
    </section>
  );
}
