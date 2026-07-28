"use client";

import { useMemo, useState } from "react";
import { Printer, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  docBtnSecondary,
  docBtnSecondaryDense,
  docCard,
  docInput,
} from "@/modules/documents/components/doc-ui";
import { ANNEX_CATEGORY_LABELS, type AnnexChangeCategory } from "@/modules/annex/types";

export interface AnnexBulkPrintRow {
  id: string;
  employeeName: string;
  annexNumber: number;
  effectiveDate: string;
  changeCategories: string[];
}

function categoryLabel(category: string): string {
  return ANNEX_CATEGORY_LABELS[category as AnnexChangeCategory] ?? category;
}

/** Pick several annexes and send them to the shared print view as one batch. */
export function AnnexBulkPrintPanel({ annexes }: { annexes: AnnexBulkPrintRow[] }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return annexes;
    return annexes.filter(
      (a) =>
        a.employeeName.toLowerCase().includes(q) ||
        String(a.annexNumber).includes(q) ||
        a.effectiveDate.includes(q),
    );
  }, [annexes, search]);

  const allFilteredSelected =
    filtered.length > 0 && filtered.every((a) => selected.has(a.id));

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAllFiltered() {
    setSelected((prev) => {
      const next = new Set(prev);
      for (const a of filtered) {
        if (allFilteredSelected) next.delete(a.id);
        else next.add(a.id);
      }
      return next;
    });
  }

  const printUrl = `/api/dokumentet/print?annexIds=${Array.from(selected).join(",")}`;

  if (annexes.length === 0) {
    return (
      <section className={docCard}>
        <div className="border-b border-[#eef2f7] px-4 py-3">
          <h2 className="text-[13.5px] font-bold text-[#0f172a]">Anekset e kontratave</h2>
        </div>
        <p className="px-4 py-4 text-[13px] text-[#64748b]">
          Nuk ka anekse të lëshuara. Gjeneroni një aneks te profili i punonjësit → Kontratat.
        </p>
      </section>
    );
  }

  return (
    <section className={docCard}>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#eef2f7] px-4 py-3">
        <h2 className="text-[13.5px] font-bold text-[#0f172a]">Anekset e kontratave</h2>
        <span className="text-[12px] text-[#94a3b8]">
          {annexes.length} anekse · {selected.size} të zgjedhura
        </span>
      </div>

      <div className="space-y-3 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[180px] flex-1">
            <Search
              className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94a3b8]"
              aria-hidden
            />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Kërko punonjës ose datë…"
              className={cn(docInput, "pl-8")}
            />
          </div>
          <button type="button" className={docBtnSecondaryDense} onClick={toggleAllFiltered}>
            {allFilteredSelected ? "Hiq të gjitha" : "Zgjidh të gjitha"}
          </button>
          {/* Secondary: the page header's "Gjenero dokumente" is the one primary. */}
          {selected.size > 0 ? (
            <a href={printUrl} target="_blank" rel="noreferrer" className={docBtnSecondary}>
              <Printer className="h-3.5 w-3.5" aria-hidden />
              Parapamje & printo ({selected.size})
            </a>
          ) : null}
        </div>

        <div className="max-h-72 overflow-auto rounded-[10px] border border-[#eef2f7]">
          {filtered.length === 0 ? (
            <p className="px-3 py-4 text-[13px] text-[#94a3b8]">Asnjë përputhje për kërkimin.</p>
          ) : (
            <ul className="m-0 list-none divide-y divide-[#f1f5f9] p-0">
              {filtered.map((a) => {
                const checked = selected.has(a.id);
                return (
                  <li key={a.id}>
                    <label
                      className={cn(
                        "flex cursor-pointer items-center gap-3 px-3 py-2.5 text-[13px] transition-colors",
                        checked ? "bg-[#eff6ff]/60" : "hover:bg-[#f8fafc]",
                      )}
                    >
                      <input
                        type="checkbox"
                        className="h-4 w-4 accent-[#2563EB]"
                        checked={checked}
                        onChange={() => toggle(a.id)}
                      />
                      <span
                        className={cn(
                          "min-w-0 flex-1",
                          checked ? "font-semibold text-[#0f172a]" : "font-medium text-[#334155]",
                        )}
                      >
                        {a.employeeName} — Aneks nr. {a.annexNumber}
                      </span>
                      <span className="shrink-0 text-[12px] tabular-nums text-[#64748b]">
                        {a.effectiveDate}
                      </span>
                      <span className="hidden shrink-0 text-[12px] text-[#94a3b8] sm:inline">
                        {a.changeCategories.map(categoryLabel).join(", ")}
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}
