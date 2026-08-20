"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, Printer, Search, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  docBtnSecondary,
  docBtnSecondaryDense,
  docCard,
  docInput,
  docSelect,
} from "@/modules/documents/components/doc-ui";
import { createWarningsBulkAction } from "@/modules/warnings/actions/warning-actions";
import { WARNING_MEASURE_OPTIONS, type WarningMeasure } from "@/modules/warnings/types";

export interface WarningEmployeeOption {
  id: string;
  label: string;
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Issues a Vërejtje to one or more employees straight from Dokumentet.
 *
 * The document generator prints existing cases, so it lists warnings rather than
 * employees; this is where a case is opened. Each selected employee gets their
 * own warning record, and the batch goes to the shared print view.
 */
export function WarningIssuePanel({ employees }: { employees: WarningEmployeeOption[] }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [measure, setMeasure] = useState<WarningMeasure>("VERBALE");
  const [issuedAt, setIssuedAt] = useState(today);
  const [improvementDeadline, setImprovementDeadline] = useState("");
  const [summary, setSummary] = useState("");
  const [saving, setSaving] = useState(false);
  const [issuedIds, setIssuedIds] = useState<string[]>([]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return employees;
    return employees.filter((e) => e.label.toLowerCase().includes(q));
  }, [employees, search]);

  const allFilteredSelected = filtered.length > 0 && filtered.every((e) => selected.has(e.id));

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    setIssuedIds([]);
  }

  function toggleAllFiltered() {
    setSelected((prev) => {
      const next = new Set(prev);
      for (const e of filtered) {
        if (allFilteredSelected) next.delete(e.id);
        else next.add(e.id);
      }
      return next;
    });
    setIssuedIds([]);
  }

  async function issue() {
    setSaving(true);
    try {
      const res = await createWarningsBulkAction({
        employeeIds: Array.from(selected),
        measure,
        issuedAt,
        summary,
        improvementDeadline: improvementDeadline || null,
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      const data = res.data!;
      setIssuedIds(data.warningIds);
      setSelected(new Set());
      toast.success(
        data.failed.length === 0
          ? `U lëshuan ${data.warningIds.length} vërejtje.`
          : `U lëshuan ${data.warningIds.length}; ${data.failed.length} dështuan.`,
      );
    } finally {
      setSaving(false);
    }
  }

  const printUrl = `/api/dokumentet/print?warningIds=${issuedIds.join(",")}`;

  return (
    <section className={docCard}>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line-soft px-4 py-3">
        <div>
          <h2 className="text-[13.5px] font-bold text-ink-900">Lësho vërejtje</h2>
          <p className="mt-0.5 text-[12px] text-ink-500">
            Zgjidhni punonjësit, masën sipas nenit 85 dhe përshkrimin e shkeljes.
          </p>
        </div>
        <span className="text-[12px] font-semibold text-brand-blue">
          {selected.size} të zgjedhur
        </span>
      </div>

      <div className="space-y-3 p-4">
        {employees.length === 0 ? (
          <p className="text-[13px] text-ink-500">Nuk ka punonjës aktivë.</p>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative min-w-[180px] flex-1">
                <Search
                  className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400"
                  aria-hidden
                />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Kërko punonjës…"
                  className={cn(docInput, "pl-8")}
                />
              </div>
              <button type="button" className={docBtnSecondaryDense} onClick={toggleAllFiltered}>
                <Users className="h-3.5 w-3.5" aria-hidden />
                {allFilteredSelected ? "Hiq të gjithë" : "Zgjidh të gjithë"}
              </button>
            </div>

            <div className="max-h-56 overflow-auto rounded-[10px] border border-line-soft">
              {filtered.length === 0 ? (
                <p className="px-3 py-4 text-[13px] text-ink-400">Asnjë përputhje për kërkimin.</p>
              ) : (
                <ul className="m-0 list-none divide-y divide-fill p-0">
                  {filtered.map((e) => {
                    const checked = selected.has(e.id);
                    return (
                      <li key={e.id}>
                        <label
                          className={cn(
                            "flex cursor-pointer items-center gap-3 px-3 py-2.5 text-[13px] transition-colors",
                            checked ? "bg-[#eff6ff]/60" : "hover:bg-fill-faint",
                          )}
                        >
                          <input
                            type="checkbox"
                            className="h-4 w-4 accent-[#2563EB]"
                            checked={checked}
                            onChange={() => toggle(e.id)}
                          />
                          <span
                            className={cn(
                              checked ? "font-semibold text-ink-900" : "font-medium text-ink-700",
                            )}
                          >
                            {e.label}
                          </span>
                        </label>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            <div className="grid gap-3 border-t border-line-soft pt-4 sm:grid-cols-3">
              <label className="grid gap-1.5">
                <span className="text-[12px] font-semibold text-ink-500">Masa</span>
                <select
                  className={docSelect}
                  value={measure}
                  onChange={(e) => setMeasure(e.target.value as WarningMeasure)}
                >
                  {WARNING_MEASURE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-1.5">
                <span className="text-[12px] font-semibold text-ink-500">Data e konstatimit</span>
                <input
                  type="date"
                  className={cn(docInput, "tabular-nums")}
                  value={issuedAt}
                  onChange={(e) => setIssuedAt(e.target.value)}
                />
              </label>
              <label className="grid gap-1.5">
                <span className="text-[12px] font-semibold text-ink-500">
                  Afati për përmirësim{measure === "ME_SHKRIM" ? "" : " (opsional)"}
                </span>
                <input
                  type="date"
                  className={cn(docInput, "tabular-nums")}
                  value={improvementDeadline}
                  onChange={(e) => setImprovementDeadline(e.target.value)}
                />
              </label>
            </div>

            <label className="grid gap-1.5">
              <span className="text-[12px] font-semibold text-ink-500">
                Përshkrimi i shkeljes / performancës së pakënaqshme
              </span>
              <textarea
                className="min-h-[86px] rounded-[10px] border border-line bg-white p-2.5 text-[13px] text-ink-700 outline-none focus:border-brand-blue"
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                placeholder="Përshkruani faktet, datën dhe rrethanat e shkeljes."
              />
            </label>

            {measure === "ME_SHKRIM" ? (
              <p className="flex items-start gap-1.5 text-[12px] text-[#b45309]">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
                Neni 70.2: vërejtja me shkrim duhet të përcaktojë afatin brenda të cilit i punësuari
                duhet ta përmirësojë performancën.
              </p>
            ) : null}

            <div className="flex flex-wrap items-center gap-2">
              {/* Secondary: "Gjenero dokumente" in the page header is the one primary. */}
              <button
                type="button"
                className={docBtnSecondary}
                disabled={saving || selected.size === 0}
                onClick={() => void issue()}
              >
                {saving ? "Duke lëshuar…" : `Lësho vërejtje (${selected.size})`}
              </button>
              {issuedIds.length > 0 ? (
                <a href={printUrl} target="_blank" rel="noreferrer" className={docBtnSecondaryDense}>
                  <Printer className="h-3.5 w-3.5" aria-hidden />
                  Parapamje & printo ({issuedIds.length})
                </a>
              ) : null}
            </div>
          </>
        )}
      </div>
    </section>
  );
}
