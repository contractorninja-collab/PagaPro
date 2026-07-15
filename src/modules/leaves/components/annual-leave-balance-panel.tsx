"use client";

import { useMemo, useState } from "react";
import type { PushimetBalanceRowDto } from "@/modules/leaves/types/pushimet";
import { LEAVE_CARD, MICRO_LABEL, TonePill } from "@/modules/leaves/components/leave-ui";

const n = (s: string | null | undefined): number => {
  const v = Number(s);
  return Number.isFinite(v) ? v : 0;
};
const fmt = (v: number): string => {
  const r = Math.round((v + Number.EPSILON) * 100) / 100;
  return String(r);
};

function daysUntil(iso: string | null): number | null {
  if (!iso) return null;
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return null;
  return Math.ceil((then - Date.now()) / 86400000);
}

/**
 * Annual-leave usage bars for the right rail (screen 5a):
 * fill = used share of (carry + entitlement); pending shown as a lighter segment;
 * low remaining renders amber, negative renders red.
 */
export function AnnualLeaveBalancePanel({
  balances,
  year,
}: {
  balances: PushimetBalanceRowDto[];
  year: number;
}) {
  const [query, setQuery] = useState("");

  const annual = useMemo(
    () => balances.filter((b) => b.leaveType === "PUSHIM_VJETOR"),
    [balances],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const rows = q
      ? annual.filter(
          (b) =>
            b.employeeName.toLowerCase().includes(q) ||
            (b.departmentName ?? "").toLowerCase().includes(q),
        )
      : annual;
    // Most-negative / lowest available first — the rows HR needs to see.
    return [...rows].sort((a, b) => n(a.remainingDays) - n(b.remainingDays));
  }, [annual, query]);

  const totals = useMemo(() => {
    let available = 0;
    let used = 0;
    let pending = 0;
    let negative = 0;
    let expiring = 0;
    for (const b of annual) {
      available += n(b.remainingDays);
      used += n(b.usedDays);
      pending += n(b.pendingDays);
      if (n(b.remainingDays) < 0) negative += 1;
      const d = daysUntil(b.carryExpiresIso);
      if (n(b.carryOverDays) > 0 && d != null && d <= 45 && d >= 0) expiring += 1;
    }
    return { available, used, pending, negative, expiring, count: annual.length };
  }, [annual]);

  if (annual.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-[#e2e8f0] bg-white px-4 py-8 text-center text-[13px] text-[#64748b]">
        Nuk ka balanca të pushimit vjetor për vitin {year} — do të popullohet kur regjistrohen punonjës dhe
        pushime.
      </div>
    );
  }

  return (
    <div className={`overflow-hidden ${LEAVE_CARD}`}>
      <div className="border-b border-[#eef2f7] px-4 py-3.5">
        <h2 className="text-[13.5px] font-bold tracking-[-0.01em] text-[#0f172a]">
          Pushimi vjetor — bilanci {year}
        </h2>
        <p className="mt-0.5 text-[11.5px] leading-relaxed text-[#94a3b8]">
          {totals.count} punonjës · mbetja e ulët në të verdhë, negative në të kuqe
        </p>
      </div>

      <div className="grid grid-cols-2 gap-px border-b border-[#eef2f7] bg-[#eef2f7]">
        <div className="bg-white px-4 py-3">
          <p className={MICRO_LABEL}>Disponueshme tani</p>
          <p className="mt-0.5 text-[20px] font-extrabold leading-none tabular-nums tracking-[-0.02em] text-[#15803d]">
            {fmt(totals.available)}
          </p>
        </div>
        <div className="bg-white px-4 py-3">
          <p className={MICRO_LABEL}>Përdorur {year}</p>
          <p className="mt-0.5 text-[20px] font-extrabold leading-none tabular-nums tracking-[-0.02em] text-[#0f172a]">
            {fmt(totals.used)}
          </p>
        </div>
        <div className="bg-white px-4 py-3">
          <p className={MICRO_LABEL}>Në pritje</p>
          <p className="mt-0.5 text-[20px] font-extrabold leading-none tabular-nums tracking-[-0.02em] text-[#0f172a]">
            {fmt(totals.pending)}
          </p>
        </div>
        <div className="bg-white px-4 py-3">
          <p className={MICRO_LABEL}>Alarme</p>
          <p className="mt-0.5 text-[20px] font-extrabold leading-none tabular-nums tracking-[-0.02em]">
            {totals.negative > 0 ? (
              <span className="text-[#dc2626]">{totals.negative} negativ</span>
            ) : (
              <span className="text-[#15803d]">0</span>
            )}
            {totals.expiring > 0 ? (
              <span className="ml-1.5 text-[13px] font-semibold text-[#b45309]">
                · {totals.expiring} skadojnë
              </span>
            ) : null}
          </p>
        </div>
      </div>

      <div className="border-b border-[#eef2f7] px-4 py-3">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Kërko punonjës ose departament…"
          className="h-9 w-full rounded-[10px] border border-[#e2e8f0] bg-white px-3 text-[13px] text-[#334155] outline-none transition-colors placeholder:text-[#94a3b8] focus-visible:border-brand-blue focus-visible:ring-2 focus-visible:ring-brand-blue/25"
        />
      </div>

      {filtered.length === 0 ? (
        <p className="px-4 py-6 text-center text-[13px] text-[#64748b]">Asnjë përputhje për kërkimin.</p>
      ) : (
        <ul className="divide-y divide-[#f1f5f9]">
          {filtered.map((b) => {
            const carry = n(b.carryOverDays);
            const entitlement = n(b.yearlyQuota);
            const accrued = n(b.accruedDays);
            const used = n(b.usedDays);
            const pending = n(b.pendingDays);
            const available = n(b.remainingDays);
            const projected = b.projectedYearEndDays != null ? n(b.projectedYearEndDays) : null;
            const total = Math.max(carry + entitlement, 0.01);
            const expiresIn = daysUntil(b.carryExpiresIso);
            const carryExpiringSoon = carry > 0 && expiresIn != null && expiresIn <= 45 && expiresIn >= 0;
            const bd = b.entitlementBreakdown;
            const entitlementHint =
              bd && (bd.tenure > 0 || bd.special > 0)
                ? ` (${bd.base}${bd.tenure > 0 ? ` +${bd.tenure} vjetërsi` : ""}${bd.special > 0 ? ` +${bd.special} kategori` : ""})`
                : "";

            const negative = available < 0;
            const low =
              !negative && (pending > available || available / total < 0.15 || available < 2);
            const fill = negative ? "bg-[#dc2626]" : low ? "bg-[#d97706]" : "bg-brand-blue";
            const valueColor = negative ? "text-[#dc2626]" : low ? "text-[#b45309]" : "text-[#15803d]";
            const usedPct = negative
              ? 100
              : Math.max(0, Math.min(100, (Math.max(0, used) / total) * 100));
            const pendingPct = negative
              ? 0
              : Math.max(0, Math.min(100 - usedPct, (Math.max(0, pending) / total) * 100));

            return (
              <li key={b.id} className="px-4 py-3 transition-colors hover:bg-[#f8fafc]">
                <div className="flex items-baseline justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-semibold text-[#0f172a]">{b.employeeName}</p>
                    <p className="truncate text-[11px] text-[#94a3b8]">
                      {b.departmentName ?? "Pa departament"}
                    </p>
                  </div>
                  <p className={`shrink-0 text-[15px] font-bold tabular-nums ${valueColor}`}>
                    {fmt(available)}
                    <span className="ml-1 text-[11px] font-medium text-[#94a3b8]">ditë</span>
                  </p>
                </div>

                <div
                  className="mt-2 flex h-1.5 w-full overflow-hidden rounded-full bg-[#eef2f7]"
                  role="img"
                  aria-label={`Përdorur ${fmt(used)}, disponueshme ${fmt(available)} nga ${fmt(carry + entitlement)} ditë`}
                >
                  <div className={`h-full ${fill}`} style={{ width: `${usedPct}%` }} />
                  <div className={`h-full opacity-40 ${fill}`} style={{ width: `${pendingPct}%` }} />
                </div>

                <p className="mt-1.5 text-[11px] tabular-nums leading-relaxed text-[#64748b]">
                  Kuota {fmt(entitlement)}
                  {entitlementHint} · Akumuluar {fmt(carry + accrued)} · Përdorur {fmt(used)} · Pritje{" "}
                  {fmt(pending)} · Fund viti {projected != null ? fmt(projected) : "—"}
                </p>

                {negative || carry > 0 || (pending > available && available >= 0) ? (
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {negative ? <TonePill tone="destructive" size="sm">Tejkalim bilanci</TonePill> : null}
                    {carry > 0 ? (
                      <TonePill tone={carryExpiringSoon ? "warning" : "neutral"} size="sm">
                        Bartur {fmt(carry)}
                        {expiresIn != null && expiresIn >= 0 ? ` · skadon për ${expiresIn} ditë` : ""}
                      </TonePill>
                    ) : null}
                    {pending > available && available >= 0 ? (
                      <TonePill tone="warning" size="sm">Pritja tejkalon bilancin</TonePill>
                    ) : null}
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}

      <p className="border-t border-[#eef2f7] bg-[#f8fafc] px-4 py-3 text-[11px] leading-relaxed text-[#94a3b8]">
        &quot;Disponueshme tani&quot; = ditët e akumuluara deri sot minus të përdorurat (plus ditët e bartura,
        nëse aktive). &quot;Fund viti&quot; është projeksioni deri më 31 dhjetor. Festat zyrtare dhe pushimi
        mjekësor gjatë pushimit vjetor nuk zbriten (Art 34).
      </p>
    </div>
  );
}
