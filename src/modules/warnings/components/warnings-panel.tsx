"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, Download, Plus, Printer, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  createWarningAction,
  deleteWarningAction,
  listWarningsAction,
} from "@/modules/warnings/actions/warning-actions";
import {
  WARNING_MEASURE_OPTIONS,
  type WarningMeasure,
  type WarningRow,
} from "@/modules/warnings/types";

const CARD = "rounded-[12px] border border-[#e2e8f0] bg-white p-4";
const BTN_PRIMARY =
  "inline-flex h-9 items-center justify-center gap-1.5 rounded-[8px] bg-brand-blue px-4 text-[13px] font-semibold text-white transition-colors hover:bg-[#1d4ed8] disabled:pointer-events-none disabled:opacity-50";
const BTN_DENSE =
  "inline-flex h-8 items-center justify-center gap-1.5 rounded-[8px] border border-[#e2e8f0] bg-white px-3 text-[12.5px] font-semibold text-[#334155] transition-colors hover:bg-[#eef2f7] disabled:pointer-events-none disabled:opacity-50";
const FIELD =
  "h-9 w-full rounded-[8px] border border-[#e2e8f0] bg-white px-2.5 text-[13px] text-[#334155] outline-none focus:border-brand-blue";

function fmt(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("sq-AL", { timeZone: "UTC" });
  } catch {
    return iso;
  }
}

function measureLabel(measure: WarningMeasure | null): string {
  return WARNING_MEASURE_OPTIONS.find((o) => o.value === measure)?.label ?? "E papërcaktuar";
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export function WarningsPanel({ employeeId, canEdit }: { employeeId: string; canEdit: boolean }) {
  const [rows, setRows] = useState<WarningRow[]>([]);
  const [formOpen, setFormOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [measure, setMeasure] = useState<WarningMeasure>("VERBALE");
  const [issuedAt, setIssuedAt] = useState(today);
  const [summary, setSummary] = useState("");
  const [improvementDeadline, setImprovementDeadline] = useState("");

  const load = useCallback(() => {
    listWarningsAction({ employeeId }).then((res) => {
      if (res.ok && res.data) setRows(res.data);
    });
  }, [employeeId]);

  useEffect(() => {
    load();
  }, [load]);

  function resetForm() {
    setMeasure("VERBALE");
    setIssuedAt(today());
    setSummary("");
    setImprovementDeadline("");
  }

  async function submit() {
    setSaving(true);
    try {
      const res = await createWarningAction({
        employeeId,
        measure,
        issuedAt,
        summary,
        improvementDeadline: improvementDeadline || null,
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Vërejtja u lëshua.");
      setFormOpen(false);
      resetForm();
      load();
    } finally {
      setSaving(false);
    }
  }

  async function remove(warningId: string) {
    setDeletingId(warningId);
    try {
      const res = await deleteWarningAction({ warningId });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Vërejtja u fshi.");
      load();
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <section className={CARD}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-[14px] font-bold text-[#0f172a]">Vërejtjet disiplinore</h3>
          <p className="mt-0.5 text-[12.5px] text-[#64748b]">
            Masat sipas nenit 85 të Ligjit të Punës. Dokumenti printohet nga shablloni përkatës.
          </p>
        </div>
        {canEdit ? (
          <button type="button" className={BTN_PRIMARY} onClick={() => setFormOpen((v) => !v)}>
            <Plus className="h-4 w-4" aria-hidden />
            Lësho vërejtje
          </button>
        ) : null}
      </div>

      {formOpen ? (
        <div className="mt-4 space-y-3 rounded-[10px] border border-[#e2e8f0] bg-[#f8fafc] p-3">
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="grid gap-1.5">
              <span className="text-[12px] font-semibold text-[#64748b]">Masa</span>
              <select
                className={FIELD}
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
              <span className="text-[12px] font-semibold text-[#64748b]">Data e konstatimit</span>
              <input
                type="date"
                className={cn(FIELD, "tabular-nums")}
                value={issuedAt}
                onChange={(e) => setIssuedAt(e.target.value)}
              />
            </label>
            <label className="grid gap-1.5">
              <span className="text-[12px] font-semibold text-[#64748b]">
                Afati për përmirësim{measure === "ME_SHKRIM" ? "" : " (opsional)"}
              </span>
              <input
                type="date"
                className={cn(FIELD, "tabular-nums")}
                value={improvementDeadline}
                onChange={(e) => setImprovementDeadline(e.target.value)}
              />
            </label>
          </div>
          <label className="grid gap-1.5">
            <span className="text-[12px] font-semibold text-[#64748b]">
              Përshkrimi i shkeljes / performancës së pakënaqshme
            </span>
            <textarea
              className="min-h-[92px] rounded-[8px] border border-[#e2e8f0] bg-white p-2.5 text-[13px] text-[#334155] outline-none focus:border-brand-blue"
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder="Përshkruani faktet, datën dhe rrethanat e shkeljes."
            />
          </label>
          {measure === "ME_SHKRIM" ? (
            <p className="flex items-start gap-1.5 text-[12px] text-[#b45309]">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
              Neni 70.2: vërejtja me shkrim duhet të përmbajë afatin brenda të cilit i punësuari
              duhet ta përmirësojë performancën.
            </p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <button type="button" className={BTN_PRIMARY} disabled={saving} onClick={() => void submit()}>
              {saving ? "Duke ruajtur…" : "Ruaj vërejtjen"}
            </button>
            <button
              type="button"
              className={BTN_DENSE}
              disabled={saving}
              onClick={() => {
                setFormOpen(false);
                resetForm();
              }}
            >
              Anulo
            </button>
          </div>
        </div>
      ) : null}

      <div className="mt-4">
        {rows.length === 0 ? (
          <p className="text-[13px] text-[#64748b]">Nuk ka vërejtje të lëshuara.</p>
        ) : (
          <ul className="m-0 list-none divide-y divide-[#f1f5f9] p-0">
            {rows.map((row) => (
              <li key={row.id} className="flex flex-wrap items-start gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-semibold text-[#0f172a]">
                    {measureLabel(row.measure)}
                  </p>
                  <p className="mt-0.5 whitespace-pre-wrap text-[12.5px] text-[#475569]">
                    {row.summary}
                  </p>
                  <p className="mt-1 text-[12px] text-[#94a3b8]">
                    Konstatuar {fmt(row.issuedAt)}
                    {row.improvementDeadline
                      ? ` · afati për përmirësim ${fmt(row.improvementDeadline)}`
                      : ""}
                  </p>
                </div>
                <div className="flex shrink-0 flex-wrap gap-2">
                  <a
                    href={`/api/punonjesit/${employeeId}/verejtje/${row.id}/print`}
                    target="_blank"
                    rel="noreferrer"
                    className={BTN_DENSE}
                  >
                    <Printer className="h-3.5 w-3.5" aria-hidden />
                    Printo
                  </a>
                  <a
                    href={`/api/punonjesit/${employeeId}/verejtje/${row.id}/document`}
                    className={BTN_DENSE}
                  >
                    <Download className="h-3.5 w-3.5" aria-hidden />
                    Shkarko
                  </a>
                  {canEdit ? (
                    <button
                      type="button"
                      className={BTN_DENSE}
                      disabled={deletingId === row.id}
                      onClick={() => void remove(row.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden />
                      Fshij
                    </button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
