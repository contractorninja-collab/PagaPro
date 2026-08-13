"use client";

import { useCallback, useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { getEmployeePresenceMonthAction } from "@/modules/timeclock/actions/timeclock-actions";
import type { PresenceEmployeeDto } from "@/modules/timeclock/services/timeclock-presence-service";

const NAV_BTN =
  "inline-flex h-7 w-7 items-center justify-center rounded-lg border border-[#e2e8f0] bg-white text-[#334155] transition-colors hover:bg-[#eef2f7]";

const h = (minutes: number): string => (minutes / 60).toFixed(1).replace(/\.0$/, "");
const hhmm = (iso: string | null): string => (iso ? iso.slice(11, 16) : "—");

/**
 * The Prezenca tab on the employee profile — one person's clocked month.
 * Self-fetching like AnnexPanel, so the profile page pays nothing for it until
 * the tab is opened.
 */
export function EmployeePresencePanel({ employeeId }: { employeeId: string }) {
  const now = new Date();
  const [year, setYear] = useState(now.getUTCFullYear());
  const [month, setMonth] = useState(now.getUTCMonth() + 1);
  const [data, setData] = useState<PresenceEmployeeDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await getEmployeePresenceMonthAction({ employeeId, year, month });
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setData(r.data ?? null);
    } finally {
      setLoading(false);
    }
  }, [employeeId, year, month]);

  useEffect(() => {
    void load();
  }, [load]);

  const step = (delta: number) => {
    const d = new Date(Date.UTC(year, month - 1 + delta, 1));
    setYear(d.getUTCFullYear());
    setMonth(d.getUTCMonth() + 1);
  };

  const monthLabel = new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString("sq-AL", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });

  return (
    <div className="rounded-xl border border-[#e2e8f0] bg-white shadow-card">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#eef2f7] px-4 py-3">
        <div className="flex items-center gap-2">
          <button type="button" aria-label="Muaji paraprak" className={NAV_BTN} onClick={() => step(-1)}>
            <ChevronLeft className="h-4 w-4" aria-hidden />
          </button>
          <h3 className="min-w-[120px] text-center text-[13px] font-bold capitalize text-[#0f172a]">
            {monthLabel}
          </h3>
          <button type="button" aria-label="Muaji tjetër" className={NAV_BTN} onClick={() => step(1)}>
            <ChevronRight className="h-4 w-4" aria-hidden />
          </button>
        </div>
        {data ? (
          <p className="text-[12px] tabular-nums text-[#64748b]">
            {h(data.totals.workedMinutes)} orë të punuara
            {data.totals.overtimeMinutes > 0 ? ` · ${h(data.totals.overtimeMinutes)} shtesë` : ""}
            {data.totals.reviewDays > 0 ? ` · ${data.totals.reviewDays} për rishikim` : ""}
          </p>
        ) : null}
      </div>

      {data && data.flags.length > 0 ? (
        <div className="flex flex-wrap gap-1.5 border-b border-[#eef2f7] px-4 py-2.5">
          {data.flags.map((f, i) => (
            <span
              key={i}
              title={f.detail}
              className={`rounded-full px-2 py-0.5 text-[10.5px] font-bold ${
                f.severity === "warn" ? "bg-[#fef2f2] text-[#dc2626]" : "bg-[#eff6ff] text-brand-blue"
              }`}
            >
              {f.article} · {f.label}
            </span>
          ))}
        </div>
      ) : null}

      {loading ? (
        <p className="px-4 py-8 text-center text-[13px] text-[#64748b]">Duke ngarkuar…</p>
      ) : error ? (
        <p className="px-4 py-8 text-center text-[13px] text-[#dc2626]">{error}</p>
      ) : !data || data.days.length === 0 ? (
        <p className="px-4 py-8 text-center text-[13px] text-[#64748b]">
          Asnjë skanim për këtë muaj.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] border-collapse text-[12.5px]">
            <thead>
              <tr className="border-b border-[#eef2f7] bg-[#f8fafc] text-left text-[10.5px] font-bold uppercase tracking-[0.05em] text-[#94a3b8]">
                <th className="px-4 py-2">Data</th>
                <th className="px-2 py-2">Hyrja</th>
                <th className="px-2 py-2">Dalja</th>
                <th className="px-2 py-2 text-right">Orë</th>
                <th className="px-2 py-2 text-right">Shtesë</th>
                <th className="px-2 py-2 text-right">Natë</th>
                <th className="px-4 py-2">Statusi</th>
              </tr>
            </thead>
            <tbody>
              {data.days.map((d) => (
                <tr key={d.workDateIso} className="border-b border-[#f6f8fb] last:border-0">
                  <td className="px-4 py-2 tabular-nums font-medium text-[#0f172a]">
                    {d.workDateIso.split("-").reverse().join(".")}
                  </td>
                  <td className="px-2 py-2 tabular-nums">{hhmm(d.firstInAtIso)}</td>
                  <td className="px-2 py-2 tabular-nums">{hhmm(d.lastOutAtIso)}</td>
                  <td className="px-2 py-2 text-right tabular-nums">{h(d.workedMinutes)}</td>
                  <td className="px-2 py-2 text-right tabular-nums text-[#b45309]">
                    {d.overtimeMinutes > 0 ? h(d.overtimeMinutes) : ""}
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums text-[#7c3aed]">
                    {d.nightMinutes + d.nightStackMinutes > 0
                      ? h(d.nightMinutes + d.nightStackMinutes)
                      : ""}
                  </td>
                  <td className="px-4 py-2">
                    {d.status === "NEEDS_REVIEW" ? (
                      <span
                        title={d.reviewReason ?? undefined}
                        className="rounded-full bg-[#fffbeb] px-2 py-0.5 text-[10.5px] font-bold text-[#b45309]"
                      >
                        Për rishikim
                      </span>
                    ) : (
                      <span className="rounded-full bg-[#ecfdf5] px-2 py-0.5 text-[10.5px] font-bold text-[#15803d]">
                        Në rregull
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
