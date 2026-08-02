"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Clock3, Download, Lock, LockOpen, RefreshCcw } from "lucide-react";
import { toast } from "sonner";
import { AppSubBar } from "@/components/layout/app-sub-bar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  lockContractorPayrollAction,
  regenerateContractorEntriesAction,
  reopenContractorPayrollAction,
  syncContractorEntryFromTimeClockAction,
  updateContractorEntryHoursAction,
} from "@/modules/payroll/contractor/contractor-actions";
import type { ContractorPeriodDetailDto } from "@/modules/payroll/contractor/contractor-payroll-service";
import { payrollMonthLabel } from "@/modules/payroll/helpers/month-label";

const STATUS_LABELS: Record<string, { label: string; variant: "secondary" | "success" }> = {
  DRAFT: { label: "Draft", variant: "secondary" },
  LOCKED: { label: "I kyçur", variant: "success" },
  ARCHIVED: { label: "I arkivuar", variant: "secondary" },
};

const HOUR_FIELDS = [
  { key: "regularHours", label: "Orë Rreg." },
  { key: "overtimeHours", label: "Orë Shtesë" },
  { key: "weekendHours", label: "Vikend" },
  { key: "holidayHours", label: "Festë" },
  { key: "nightHours", label: "Natë" },
] as const;

type HourKey = (typeof HOUR_FIELDS)[number]["key"];
type RowDraft = Record<HourKey, string>;

function formatEuro(raw: string): string {
  const n = Number(raw);
  if (!Number.isFinite(n)) return `€${raw}`;
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "EUR" }).format(n);
}

export function ContractorPayrollDetailClient(props: { detail: ContractorPeriodDetailDto }) {
  const { detail } = props;
  const router = useRouter();
  const editable = detail.status === "DRAFT";
  const status = STATUS_LABELS[detail.status] ?? STATUS_LABELS.DRAFT!;

  const [drafts, setDrafts] = useState<Record<string, RowDraft>>(() =>
    Object.fromEntries(
      detail.entries.map((e) => [
        e.id,
        {
          regularHours: e.regularHours,
          overtimeHours: e.overtimeHours,
          weekendHours: e.weekendHours,
          holidayHours: e.holidayHours,
          nightHours: e.nightHours,
        },
      ]),
    ),
  );
  const [busyRow, setBusyRow] = useState<string | null>(null);
  const [busyGlobal, setBusyGlobal] = useState(false);

  function setDraft(entryId: string, key: HourKey, value: string) {
    setDrafts((prev) => ({
      ...prev,
      [entryId]: { ...prev[entryId]!, [key]: value },
    }));
  }

  function rowDirty(entryId: string): boolean {
    const entry = detail.entries.find((e) => e.id === entryId);
    const draft = drafts[entryId];
    if (!entry || !draft) return false;
    return HOUR_FIELDS.some((f) => Number(draft[f.key]) !== Number(entry[f.key]));
  }

  async function saveRow(entryId: string) {
    const draft = drafts[entryId];
    if (!draft) return;
    setBusyRow(entryId);
    const r = await updateContractorEntryHoursAction({
      periodId: detail.id,
      entryId,
      regularHours: draft.regularHours === "" ? 0 : draft.regularHours.replace(",", "."),
      overtimeHours: draft.overtimeHours === "" ? 0 : draft.overtimeHours.replace(",", "."),
      weekendHours: draft.weekendHours === "" ? 0 : draft.weekendHours.replace(",", "."),
      holidayHours: draft.holidayHours === "" ? 0 : draft.holidayHours.replace(",", "."),
      nightHours: draft.nightHours === "" ? 0 : draft.nightHours.replace(",", "."),
    });
    setBusyRow(null);
    if (!r.ok) {
      toast.error(r.error);
      return;
    }
    toast.success(`Orët u ruajtën — bruto ${formatEuro(r.data?.grossPay ?? "0")}.`);
    router.refresh();
  }

  async function syncRow(entryId: string) {
    setBusyRow(entryId);
    const r = await syncContractorEntryFromTimeClockAction({ periodId: detail.id, entryId });
    setBusyRow(null);
    if (!r.ok) {
      toast.error(r.error);
      return;
    }
    const review = r.data?.daysNeedingReview ?? 0;
    if (review > 0) {
      toast.warning(
        `Orët u plotësuan nga ora e punës, por ${review} ditë kanë skanime të papërputhura dhe nuk llogariten.`,
      );
    } else {
      toast.success(`Orët u plotësuan nga ora e punës — bruto ${formatEuro(r.data?.grossPay ?? "0")}.`);
    }
    router.refresh();
  }

  async function runGlobal(fn: () => Promise<{ ok: boolean; error?: string }>, okMsg: string) {
    setBusyGlobal(true);
    const r = await fn();
    setBusyGlobal(false);
    if (!r.ok) {
      toast.error(r.error ?? "Gabim i papritur.");
      return;
    }
    toast.success(okMsg);
    router.refresh();
  }

  return (
    <>
      <AppSubBar
        eyebrow="Payroll — Kontraktor"
        title={payrollMonthLabel(detail.year, detail.month)}
        description="Orë × tarifë orare me premium (shtesë, vikend, festë, natë). Bruto = neto — pa tatim, pa Trust."
        actions={
          <div className="flex flex-wrap items-center gap-2.5">
            <a
              href={`/api/pagat/kontraktor/${detail.id}/csv`}
              className="inline-flex h-10 items-center gap-1.5 rounded-[10px] border border-[#e2e8f0] bg-white px-[15px] text-[13px] font-semibold text-[#334155] transition-colors hover:bg-[#eef2f7]"
            >
              <Download className="h-4 w-4" aria-hidden />
              Shkarko CSV
            </a>
            {editable ? (
              <>
                <Button
                  type="button"
                  variant="secondary"
                  className="h-10 gap-1.5 rounded-[10px]"
                  disabled={busyGlobal}
                  onClick={() =>
                    void runGlobal(
                      () => regenerateContractorEntriesAction({ periodId: detail.id }),
                      "Lista u rifreskua me kontraktorët dhe tarifat aktuale.",
                    )
                  }
                >
                  <RefreshCcw className="h-4 w-4" aria-hidden />
                  Rifresko listën
                </Button>
                <Button
                  type="button"
                  className="h-10 gap-1.5 rounded-[10px] bg-brand-blue text-white hover:bg-[#1d4ed8]"
                  disabled={busyGlobal}
                  onClick={() =>
                    void runGlobal(
                      () => lockContractorPayrollAction({ periodId: detail.id }),
                      "Periudha u kyç.",
                    )
                  }
                >
                  <Lock className="h-4 w-4" aria-hidden />
                  Kyç periudhën
                </Button>
              </>
            ) : detail.status === "LOCKED" ? (
              <Button
                type="button"
                variant="secondary"
                className="h-10 gap-1.5 rounded-[10px]"
                disabled={busyGlobal}
                onClick={() =>
                  void runGlobal(
                    () => reopenContractorPayrollAction({ periodId: detail.id }),
                    "Periudha u rihap si draft.",
                  )
                }
              >
                <LockOpen className="h-4 w-4" aria-hidden />
                Rihap
              </Button>
            ) : null}
          </div>
        }
      />

      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <Link
            href="/pagat/kontraktor"
            className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-[#64748b] hover:text-[#334155]"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden />
            Kthehu te periudhat
          </Link>
          <Badge variant={status.variant}>{status.label}</Badge>
          <span className="text-xs text-muted-foreground">
            Multipliers: OT ×{detail.multipliers.overtime} · Vikend ×{detail.multipliers.weekend} · Festë ×
            {detail.multipliers.holiday} · Natë ×{detail.multipliers.night}
          </span>
        </div>

        {detail.warnings.length > 0 ? (
          <div className="rounded-[10px] border border-amber-200 bg-amber-50 px-4 py-3">
            <ul className="list-disc space-y-1 pl-5 text-[13px] text-amber-900">
              {detail.warnings.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="overflow-x-auto rounded-[12px] border border-[#e2e8f0] bg-white">
          <table className="w-full min-w-[900px] text-sm">
            <thead>
              <tr className="border-b border-[#e2e8f0] text-left text-[12px] uppercase tracking-wide text-[#94a3b8]">
                <th className="px-4 py-3 font-semibold">Kontraktori</th>
                <th className="px-3 py-3 text-right font-semibold">Tarifa €/orë</th>
                {HOUR_FIELDS.map((f) => (
                  <th key={f.key} className="px-2 py-3 text-right font-semibold">
                    {f.label}
                  </th>
                ))}
                <th className="px-3 py-3 text-center font-semibold">Burimi</th>
                <th className="px-3 py-3 text-right font-semibold">Bruto</th>
                {editable ? <th className="px-3 py-3 text-right font-semibold">Veprime</th> : null}
              </tr>
            </thead>
            <tbody>
              {detail.entries.map((e) => {
                const draft = drafts[e.id];
                const busy = busyRow === e.id;
                return (
                  <tr key={e.id} className="border-b border-[#f1f5f9] last:border-0">
                    <td className="px-4 py-2.5">
                      <p className="font-semibold text-[#0f172a]">
                        {e.lastName}, {e.firstName}
                      </p>
                      <p className="text-xs text-muted-foreground">{e.personalId}</p>
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums">
                      {Number(e.hourlyRate) > 0 ? (
                        e.hourlyRate
                      ) : (
                        <span className="font-semibold text-destructive">mungon</span>
                      )}
                    </td>
                    {HOUR_FIELDS.map((f) => (
                      <td key={f.key} className="px-2 py-2.5 text-right">
                        {editable ? (
                          <Input
                            className="h-8 w-[72px] text-right tabular-nums"
                            inputMode="decimal"
                            value={draft?.[f.key] ?? ""}
                            onChange={(ev) => setDraft(e.id, f.key, ev.target.value)}
                            disabled={busy}
                            aria-label={`${f.label} — ${e.firstName} ${e.lastName}`}
                          />
                        ) : (
                          <span className="tabular-nums">{e[f.key]}</span>
                        )}
                      </td>
                    ))}
                    <td className="px-3 py-2.5 text-center">
                      <span className="text-[11px] font-semibold uppercase text-muted-foreground">
                        {e.hoursSource === "TIMECLOCK" ? "Ora e punës" : "Manual"}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-right font-semibold tabular-nums">
                      {formatEuro(e.grossPay)}
                    </td>
                    {editable ? (
                      <td className="px-3 py-2.5">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            type="button"
                            size="sm"
                            variant="secondary"
                            className="h-8 gap-1 px-2.5 text-xs"
                            disabled={busy}
                            onClick={() => void syncRow(e.id)}
                            title="Plotëso orët nga skanimet e orës së punës"
                          >
                            <Clock3 className="h-3.5 w-3.5" aria-hidden />
                            Nga ora
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            className="h-8 px-3 text-xs"
                            disabled={busy || !rowDirty(e.id)}
                            onClick={() => void saveRow(e.id)}
                          >
                            {busy ? "…" : "Ruaj"}
                          </Button>
                        </div>
                      </td>
                    ) : null}
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t border-[#e2e8f0] bg-[#f8fafc]">
                <td className="px-4 py-3 text-[13px] font-bold uppercase tracking-wide text-[#334155]">
                  Totali
                </td>
                <td />
                {HOUR_FIELDS.map((f) => (
                  <td key={f.key} className="px-2 py-3 text-right font-semibold tabular-nums">
                    {detail.entries.reduce((s, e) => s + Number(e[f.key]), 0).toFixed(2)}
                  </td>
                ))}
                <td />
                <td className="px-3 py-3 text-right text-[15px] font-extrabold tabular-nums text-[#0f172a]">
                  {formatEuro(detail.totalGross)}
                </td>
                {editable ? <td /> : null}
              </tr>
            </tfoot>
          </table>
        </div>

        <p className="text-xs text-muted-foreground">
          &quot;Nga ora&quot; rillogarit ditët nga skanimet reale të kartelave dhe i mbush orët automatikisht;
          çdo fushë mbetet e redaktueshme pas plotësimit. Ditët me skanime të papërputhura nuk llogariten
          derisa të rregullohen.
        </p>
      </div>
    </>
  );
}
