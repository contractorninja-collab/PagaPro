"use client";

import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import type { PushimetBalanceRowDto } from "@/modules/leaves/types/pushimet";

const n = (s: string | null | undefined): number => {
  const v = Number(s);
  return Number.isFinite(v) ? v : 0;
};
const fmt = (v: number): string => {
  const r = Math.round((v + Number.EPSILON) * 100) / 100;
  return Number.isInteger(r) ? String(r) : String(r);
};

function daysUntil(iso: string | null): number | null {
  if (!iso) return null;
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return null;
  return Math.ceil((then - Date.now()) / 86400000);
}

/** Stacked bar: used | available-now | still-to-accrue, over (carry + entitlement). */
function BalanceBar({
  total,
  used,
  available,
  accrued,
}: {
  total: number;
  used: number;
  available: number;
  accrued: number;
}) {
  const t = Math.max(total, 0.01);
  const usedPct = Math.max(0, Math.min(100, (Math.max(0, used) / t) * 100));
  const availPct = Math.max(0, Math.min(100 - usedPct, (Math.max(0, available) / t) * 100));
  const toAccruePct = Math.max(0, Math.min(100 - usedPct - availPct, ((total - accrued) / t) * 100));
  const overdrawn = available < 0;
  return (
    <div
      className="flex h-3 w-full overflow-hidden rounded-full bg-muted"
      role="img"
      aria-label={`Përdorur ${fmt(used)}, disponueshme ${fmt(available)} nga ${fmt(total)} ditë`}
    >
      {overdrawn ? (
        <div className="h-full bg-destructive" style={{ width: "100%" }} />
      ) : (
        <>
          <div className="h-full bg-slate-400 dark:bg-slate-500" style={{ width: `${usedPct}%` }} />
          <div className="h-full bg-emerald-500" style={{ width: `${availPct}%` }} />
          <div
            className="h-full bg-emerald-500/25"
            style={{
              width: `${toAccruePct}%`,
              backgroundImage:
                "repeating-linear-gradient(45deg, transparent, transparent 4px, rgba(16,185,129,0.35) 4px, rgba(16,185,129,0.35) 8px)",
            }}
          />
        </>
      )}
    </div>
  );
}

function Metric({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-sm font-semibold tabular-nums text-foreground">
        {value}
        {hint ? <span className="ml-1 text-xs font-normal text-muted-foreground">{hint}</span> : null}
      </p>
    </div>
  );
}

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
      <p className="rounded-lg border border-dashed border-border bg-card px-4 py-8 text-center text-sm text-muted-foreground">
        Nuk ka balanca të pushimit vjetor për vitin {year} — do të popullohet kur regjistrohen punonjës dhe pushime.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="p-4">
          <p className="text-xs font-medium text-muted-foreground">Disponueshme tani (gjithsej)</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
            {fmt(totals.available)}
          </p>
          <p className="text-xs text-muted-foreground">{totals.count} punonjës</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs font-medium text-muted-foreground">Të përdorura (viti {year})</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-foreground">{fmt(totals.used)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs font-medium text-muted-foreground">Në pritje</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-foreground">{fmt(totals.pending)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs font-medium text-muted-foreground">Alarme</p>
          <p className="mt-1 flex items-baseline gap-2 text-2xl font-semibold tabular-nums text-foreground">
            {totals.negative > 0 ? (
              <span className="text-destructive">{totals.negative} negativ</span>
            ) : (
              <span className="text-emerald-600 dark:text-emerald-400">0</span>
            )}
            {totals.expiring > 0 ? (
              <span className="text-base font-medium text-amber-700 dark:text-amber-300">
                · {totals.expiring} skadojnë
              </span>
            ) : null}
          </p>
        </Card>
      </div>

      <div className="flex items-center justify-between gap-2">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Kërko punonjës ose departament…"
          className="h-9 w-full max-w-xs rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        <p className="shrink-0 text-xs text-muted-foreground">
          E gjelbër = disponueshme · e vijëzuar = akumulohet deri në fund të vitit
        </p>
      </div>

      <div className="space-y-2.5">
        {filtered.map((b) => {
          const carry = n(b.carryOverDays);
          const entitlement = n(b.yearlyQuota);
          const accrued = n(b.accruedDays);
          const used = n(b.usedDays);
          const pending = n(b.pendingDays);
          const available = n(b.remainingDays);
          const projected = b.projectedYearEndDays != null ? n(b.projectedYearEndDays) : null;
          const total = carry + entitlement;
          const expiresIn = daysUntil(b.carryExpiresIso);
          const carryExpiringSoon = carry > 0 && expiresIn != null && expiresIn <= 45 && expiresIn >= 0;
          const bd = b.entitlementBreakdown;
          const entitlementHint =
            bd && (bd.tenure > 0 || bd.special > 0)
              ? `(${bd.base}${bd.tenure > 0 ? ` +${bd.tenure} vjetërsi` : ""}${bd.special > 0 ? ` +${bd.special} kategori` : ""})`
              : undefined;

          return (
            <Card key={b.id} className="p-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="min-w-0 lg:w-56">
                  <p className="truncate font-medium text-foreground">{b.employeeName}</p>
                  <p className="truncate text-xs text-muted-foreground">{b.departmentName ?? "Pa departament"}</p>
                </div>

                <div className="min-w-0 flex-1 space-y-1.5">
                  <BalanceBar total={total} used={used} available={available} accrued={carry + accrued} />
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                    <Metric label="Kuota vjetore" value={fmt(entitlement)} hint={entitlementHint} />
                    <Metric label="Akumuluar" value={fmt(carry + accrued)} />
                    <Metric label="Përdorur" value={fmt(used)} />
                    <Metric label="Në pritje" value={fmt(pending)} />
                    <Metric label="Fund viti" value={projected != null ? fmt(projected) : "—"} />
                  </div>
                </div>

                <div className="flex shrink-0 flex-col items-start gap-1.5 lg:items-end">
                  <div>
                    <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                      Disponueshme tani
                    </p>
                    <p
                      className={`text-2xl font-semibold tabular-nums ${
                        available < 0
                          ? "text-destructive"
                          : "text-emerald-600 dark:text-emerald-400"
                      }`}
                    >
                      {fmt(available)}
                      <span className="ml-1 text-sm font-normal text-muted-foreground">ditë</span>
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-1.5 lg:justify-end">
                    {available < 0 ? <Badge variant="destructive">Tejkalim bilanci</Badge> : null}
                    {carry > 0 ? (
                      <Badge variant={carryExpiringSoon ? "warning" : "secondary"}>
                        Bartur {fmt(carry)}
                        {expiresIn != null && expiresIn >= 0
                          ? ` · skadon për ${expiresIn} ditë`
                          : ""}
                      </Badge>
                    ) : null}
                    {pending > available && available >= 0 ? (
                      <Badge variant="warning">Pritja tejkalon bilancin</Badge>
                    ) : null}
                  </div>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
