"use client";

import { useState } from "react";
import Link from "next/link";
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
  audit: "bg-[#f1f5f9] text-[#475569]",
};

const VISIBLE_ENTRY_LIMIT = 9;

export function ActivityLogCard({ entries }: { entries: TimelineEntryDto[] }) {
  const [filter, setFilter] = useState<ActivityFilter>("all");
  const filteredEntries = entries
    .filter((entry) => filter === "all" || SOURCE_CATEGORY[entry.source] === filter)
    .slice(0, VISIBLE_ENTRY_LIMIT);

  return (
    <section
      id="activity-log"
      className="overflow-hidden rounded-lg border border-[#e2e8f0] bg-white shadow-[0_1px_3px_rgba(15,23,42,0.05)]"
      aria-labelledby="activity-log-title"
    >
      <div className="border-b border-[#f1f5f9] px-5 pb-4 pt-[18px]">
        <h3 id="activity-log-title" className="text-[15px] font-bold text-[#0f172a]">
          Aktiviteti i fundit
        </h3>
        <p className="mt-0.5 text-[12px] text-[#94a3b8]">
          Veprimet më të fundit operative, të auditimit dhe HR.
        </p>

        <div
          className="mt-3 inline-flex max-w-full overflow-x-auto rounded-md border border-[#e2e8f0] bg-[#f8fafc] p-0.5"
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
                  ? "bg-white text-[#0f172a] shadow-sm"
                  : "text-[#64748b] hover:text-[#0f172a]",
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {filteredEntries.length === 0 ? (
        <p className="px-5 py-8 text-center text-sm text-[#64748b]">
          Nuk ka ngjarje për këtë filtër.
        </p>
      ) : (
        <ul className="divide-y divide-[#f1f5f9]">
          {filteredEntries.map((entry) => {
            const category = SOURCE_CATEGORY[entry.source];
            return (
              <li key={entry.id} className="px-5 py-3 transition-colors hover:bg-[#f8fafc]">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-semibold leading-snug text-[#0f172a]">
                      {entry.title}
                    </p>
                    {entry.subtitle ? (
                      <p className="mt-0.5 break-words text-[11.5px] text-[#64748b]">
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
                        <span className="text-[11px] text-[#94a3b8]">
                          nga {entry.actorLabel}
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <time
                    className="shrink-0 text-[11px] tabular-nums text-[#94a3b8]"
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

      <div className="border-t border-[#f1f5f9] px-5 py-3 text-right">
        {/* TODO: Replace this stub when a dedicated company activity-history route exists. */}
        <Link
          href="/paneli/aktiviteti"
          className="text-[12px] font-semibold text-brand-blue hover:underline"
        >
          Shiko historikun e plotë
        </Link>
      </div>
    </section>
  );
}
