"use client";

import { useId, useMemo, useState } from "react";
import { Search } from "lucide-react";
import { matchesQuery } from "@/lib/search";
import { BTN_SECONDARY_DENSE, FIELD_CONTROL, MICRO_LABEL, TonePill } from "@/modules/leaves/components/leave-ui";
import { LeaveBalanceRow } from "@/modules/leaves/components/leave-balance-row";
import {
  collapseCohorts,
  compareAttention,
  evaluateBalanceAttention,
  type AttentionContext,
  type AttentionEntry,
} from "@/modules/leaves/helpers/leave-balance-attention";
import type { PushimetBalanceRowDto } from "@/modules/leaves/types/pushimet";

/**
 * The searchable, attention-first body shared by both balance panels.
 *
 * Default view is the few people who need a decision. Everyone else folds into
 * one line with a count. Typing bypasses the split entirely and searches all
 * rows, which is the point: the fold is a default, never a barrier.
 */
export function LeaveBalanceList({
  rows,
  attention,
  showTypePill = false,
  searchPlaceholder = "Kërko punonjës ose departament…",
  emptyText,
}: {
  rows: PushimetBalanceRowDto[];
  attention: AttentionContext;
  showTypePill?: boolean;
  searchPlaceholder?: string;
  /** Shown when there are no rows at all, as opposed to none matching a search. */
  emptyText: string;
}) {
  const [query, setQuery] = useState("");
  const [showAll, setShowAll] = useState(false);
  const listId = useId();

  const searching = query.trim().length > 0;

  /**
   * What one row means. The annual panel holds one row per person, so "punonjës"
   * is accurate. The other-types panel holds one row per person PER QUOTA —
   * six employees with a personal and a medical entitlement are twelve rows —
   * so counting them as people would report the company as twice its size.
   * showTypePill is exactly that distinction: it is set when a row has to name
   * which quota it is about.
   */
  const unit = showTypePill ? { one: "rresht", many: "rreshta" } : { one: "punonjës", many: "punonjës" };

  const entries = useMemo<AttentionEntry[]>(
    () => rows.map((row) => ({ row, verdict: evaluateBalanceAttention(row, attention) })),
    [rows, attention],
  );

  const matched = useMemo(
    () => entries.filter((e) => matchesQuery(query, e.row.employeeName, e.row.departmentName)),
    [entries, query],
  );

  const { cohorts, rows: attentionRows } = useMemo(() => collapseCohorts(entries), [entries]);

  const sortedAttention = useMemo(
    () => [...attentionRows].sort(compareAttention),
    [attentionRows],
  );

  // Everything not listed individually: the calm majority, plus anyone folded
  // into a cohort strip. Cohort members must land here or the strip would be a
  // dead end — it tells you thirteen people share a state and gives you no way
  // to learn which thirteen.
  //
  // Sorted flagged-first, then by name. Name rather than lowest-balance: that
  // order is only right if a low balance means trouble, and for anyone still
  // accruing it does not — it used to put the three newest hires at the very
  // top of the list as though they were the three worst cases.
  const hidden = useMemo(() => {
    const listed = new Set(attentionRows.map((e) => e.row.id));
    return entries
      .filter((e) => !listed.has(e.row.id))
      .sort((a, b) => {
        if (a.verdict.needsAttention !== b.verdict.needsAttention) {
          return a.verdict.needsAttention ? -1 : 1;
        }
        if (a.verdict.needsAttention) return compareAttention(a, b);
        return a.row.employeeName.localeCompare(b.row.employeeName, "sq-AL");
      });
  }, [entries, attentionRows]);

  const searchResults = useMemo(() => [...matched].sort(compareAttention), [matched]);

  if (rows.length === 0) {
    return <p className="px-4 py-6 text-center text-[13px] text-ink-500">{emptyText}</p>;
  }

  return (
    <div>
      <div className="relative px-4 pb-3 pt-1">
        <Search
          className="pointer-events-none absolute left-[26px] top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-400"
          aria-hidden
        />
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={searchPlaceholder}
          aria-label={searchPlaceholder}
          className={`${FIELD_CONTROL} h-9 pl-8`}
        />
      </div>

      {searching ? (
        searchResults.length === 0 ? (
          <p className="px-4 py-6 text-center text-[13px] text-ink-400">Asnjë përputhje për kërkimin.</p>
        ) : (
          <>
            <p className={`px-4 pb-1.5 ${MICRO_LABEL}`}>
              {searchResults.length} {searchResults.length === 1 ? "rezultat" : "rezultate"}
            </p>
            <ul className="divide-y divide-fill border-t border-fill">
              {searchResults.map((e) => (
                <LeaveBalanceRow key={e.row.id} row={e.row} verdict={e.verdict} showTypePill={showTypePill} />
              ))}
            </ul>
          </>
        )
      ) : (
        <>
          {cohorts.length > 0 ? (
            <ul className="space-y-1.5 px-4 pb-3">
              {cohorts.map((cohort) => (
                <li
                  key={cohort.key}
                  className="flex flex-wrap items-center gap-2 rounded-[10px] bg-fill-faint px-3 py-2 text-[12.5px] text-ink-700"
                >
                  <TonePill tone={cohort.tone} size="sm">
                    {cohort.count}
                  </TonePill>
                  <span>{cohort.label}</span>
                </li>
              ))}
            </ul>
          ) : null}

          {sortedAttention.length > 0 ? (
            <>
              <p className={`px-4 pb-1.5 ${MICRO_LABEL}`}>
                Kanë nevojë për vëmendje ({sortedAttention.length})
              </p>
              <ul className="divide-y divide-fill border-t border-fill">
                {sortedAttention.map((e) => (
                  <LeaveBalanceRow key={e.row.id} row={e.row} verdict={e.verdict} showTypePill={showTypePill} />
                ))}
              </ul>
            </>
          ) : cohorts.length === 0 ? (
            // Naming what was checked turns "nothing here" into a result rather
            // than a panel that looks broken. On a healthy company in the middle
            // of the year this is the normal state, and it should read that way.
            <p className="px-4 pb-3 text-[13px] leading-relaxed text-ink-500">
              Asnjë punonjës nuk kërkon vëmendje.
              <span className="mt-0.5 block text-[11.5px] text-ink-400">
                Kontrolluar: bilanc negativ, kërkesa mbi kuotën vjetore, ditë të bartura që skadojnë.
              </span>
            </p>
          ) : null}

          {hidden.length > 0 ? (
            <div className="border-t border-fill">
              <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5">
                <p className="text-[12.5px] text-ink-500">
                  {cohorts.length > 0
                    ? `${hidden.length} ${hidden.length === 1 ? `${unit.one} tjetër` : `${unit.many} të tjerë`}`
                    : `${hidden.length} ${
                        hidden.length === 1 ? `${unit.one} tjetër është` : `${unit.many} të tjerë janë`
                      } brenda normales.`}
                </p>
                <button
                  type="button"
                  onClick={() => setShowAll((v) => !v)}
                  aria-expanded={showAll}
                  aria-controls={listId}
                  className={BTN_SECONDARY_DENSE}
                >
                  {showAll ? "Fshih" : "Shfaq të gjithë"}
                </button>
              </div>
              {/* Rendered even when collapsed, with `hidden`. The conditional
                  version left aria-controls pointing at an id that was not in
                  the document, so a screen reader following the button's own
                  reference found nothing — the one moment the association
                  matters is before you open it. */}
              <ul
                id={listId}
                hidden={!showAll}
                className="divide-y divide-fill border-t border-fill"
              >
                {hidden.map((e) => (
                  <LeaveBalanceRow key={e.row.id} row={e.row} verdict={e.verdict} showTypePill={showTypePill} />
                ))}
              </ul>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
