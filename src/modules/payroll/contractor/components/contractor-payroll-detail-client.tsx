"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Clock3, Download, Lock, LockOpen, RefreshCcw } from "lucide-react";
import { toast } from "sonner";
import { AppSubBar } from "@/components/layout/app-sub-bar";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useCan } from "@/components/layout/capability-provider";
import {
  CELL_BASE,
  cellTone,
  sumPlainEuro,
  useSavedPulse,
} from "@/modules/payroll/components/spreadsheet/spreadsheet-primitives";
import {
  lockContractorPayrollAction,
  regenerateContractorEntriesAction,
  reopenContractorPayrollAction,
  syncContractorEntryFromTimeClockAction,
  updateContractorEntryHoursAction,
} from "@/modules/payroll/contractor/contractor-actions";
import type {
  ContractorEntryDto,
  ContractorPeriodDetailDto,
} from "@/modules/payroll/contractor/contractor-payroll-service";
import { payrollMonthLabel } from "@/modules/payroll/helpers/month-label";

const STATUS_LABELS: Record<string, { label: string; variant: "secondary" | "success" }> = {
  DRAFT: { label: "Draft", variant: "secondary" },
  LOCKED: { label: "I kyçur", variant: "success" },
  ARCHIVED: { label: "I arkivuar", variant: "secondary" },
};

type EditableField =
  | "monthlyFlatAmount"
  | "regularHours"
  | "overtimeHours"
  | "weekendHours"
  | "holidayHours"
  | "nightHours";

const HOUR_COLUMNS: ReadonlyArray<{ key: Exclude<EditableField, "monthlyFlatAmount">; label: string }> = [
  { key: "regularHours", label: "Orë Rreg." },
  { key: "overtimeHours", label: "Orë Shtesë" },
  { key: "weekendHours", label: "Vikend" },
  { key: "holidayHours", label: "Festë" },
  { key: "nightHours", label: "Natë" },
];

/**
 * One editable grid cell, in the exact idiom of the employee spreadsheet:
 * saves on blur, blue while in flight, emerald pulse when saved, value synced
 * back after router.refresh(). The action recomputes the row's pay server-side
 * (flat fee + premium hours), so no client math ever disagrees with the DB.
 */
function ContractorCell(props: {
  disabled: boolean;
  periodId: string;
  entry: ContractorEntryDto;
  field: EditableField;
  title?: string;
  onSaved?: () => void;
}) {
  const router = useRouter();
  const serverValue = String(props.entry[props.field] ?? "");
  const [val, setVal] = useState(serverValue);
  const [state, setState] = useSavedPulse();

  useEffect(() => {
    setVal(serverValue);
  }, [serverValue]);

  return (
    <input
      type="text"
      inputMode="decimal"
      disabled={props.disabled}
      value={val}
      title={props.title}
      onChange={(ev) => setVal(ev.target.value)}
      className={cn(CELL_BASE, cellTone(state, false))}
      onBlur={async (ev) => {
        const v = ev.target.value.trim();
        if (v === serverValue) return;
        setState("saving");
        const e = props.entry;
        const norm = (raw: string) => (raw.trim() === "" ? "0" : raw.replace(",", "."));
        const next = { ...e, [props.field]: v };
        const r = await updateContractorEntryHoursAction({
          periodId: props.periodId,
          entryId: e.id,
          regularHours: norm(next.regularHours),
          overtimeHours: norm(next.overtimeHours),
          weekendHours: norm(next.weekendHours),
          holidayHours: norm(next.holidayHours),
          nightHours: norm(next.nightHours),
          ...(e.payBasis === "MONTHLY_FLAT"
            ? { monthlyFlatAmount: norm(next.monthlyFlatAmount) }
            : {}),
        });
        if (!r.ok) {
          toast.error(r.error);
          setVal(serverValue);
          setState("idle");
          return;
        }
        setState("saved");
        props.onSaved?.();
        queueMicrotask(() => {
          void router.refresh();
        });
      }}
    />
  );
}

export function ContractorPayrollDetailClient(props: { detail: ContractorPeriodDetailDto }) {
  const { detail } = props;
  const router = useRouter();
  /**
   * `editable` was purely about status. The grid's cells and the refresh are
   * payroll.prepare; locking and reopening the period are payroll.signoff, so
   * the two are asked separately rather than folded into one flag.
   */
  const canPreparePayroll = useCan("payroll.prepare");
  const canSignOffPayroll = useCan("payroll.signoff");
  const editable = detail.status === "DRAFT" && canPreparePayroll;
  const status = STATUS_LABELS[detail.status] ?? STATUS_LABELS.DRAFT!;

  const [busyGlobal, setBusyGlobal] = useState(false);
  const [busyRow, setBusyRow] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const markSaved = useCallback(() => setSavedAt(new Date()), []);

  const footPay = sumPlainEuro(detail.entries.map((e) => e.grossPay));

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
      toast.success("Orët u plotësuan nga ora e punës.");
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

  /** Identical grid chrome to the employee spreadsheet. */
  const thNum =
    "min-w-[84px] w-auto whitespace-nowrap border-b border-line px-1.5 py-[7px] text-right text-[10.5px] font-semibold leading-tight text-ink-500";
  const thBand =
    "border-b border-line px-1.5 py-[5px] text-left text-[9.5px] font-bold uppercase tracking-[0.08em] text-ink-400";
  const tdNum =
    "min-w-[84px] w-auto whitespace-nowrap px-1.5 py-1.5 text-right text-xs text-ink-500 [font-variant-numeric:tabular-nums]";
  const tdInput = "min-w-[84px] w-auto px-1 py-[5px] align-middle";
  const stickyShadow = "shadow-[4px_0_8px_-4px_rgba(0,0,0,0.12)]";
  const stickyShadowRight = "shadow-[-4px_0_8px_-4px_rgba(0,0,0,0.12)]";
  const footCell =
    "min-w-[84px] w-auto whitespace-nowrap px-1.5 py-[9px] text-right text-xs [font-variant-numeric:tabular-nums]";

  return (
    <>
      <AppSubBar
        eyebrow="Payroll — Kontraktor"
        title={payrollMonthLabel(detail.year, detail.month)}
        description="Pagë mujore fikse ose orë × tarifë; orët shtesë, vikend, festë dhe natë paguhen me premium mbi pagën. Shuma është neto — pa tatim, pa Trust."
        actions={
          <div className="flex flex-wrap items-center gap-2.5">
            <a
              href={`/api/pagat/kontraktor/${detail.id}/csv`}
              className="inline-flex h-10 items-center gap-1.5 rounded-[10px] border border-line bg-white px-[15px] text-[13px] font-semibold text-ink-700 transition-colors hover:bg-fill-hover"
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
                  className="h-10 gap-1.5 rounded-[10px] bg-brand-blue text-white hover:bg-brand-blue-strong"
                  disabled={busyGlobal || !canSignOffPayroll}
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
                disabled={busyGlobal || !canSignOffPayroll}
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
            className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-ink-500 hover:text-ink-700"
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

        {detail.entries.length === 0 ? (
          <div className="rounded-xl border border-line bg-white px-6 py-14 text-center shadow-card">
            <p className="text-sm font-semibold text-ink-900">Nuk ka kontraktorë në këtë periudhë.</p>
            <p className="mx-auto mt-2 max-w-md text-[13px] text-ink-500">
              Shtypni &bdquo;Rifresko listën&rdquo; për t&apos;i mbushur rreshtat nga kontraktorët aktivë.
            </p>
          </div>
        ) : (
          <>
            <div className="hidden md:block">
              <div className="overflow-hidden rounded-xl border border-line bg-white shadow-card">
                <div className="relative max-h-[min(70vh,720px)] overflow-x-auto overflow-y-auto">
                  <table className="w-full min-w-[1180px] border-collapse text-xs">
                    {/* Two header rows, exactly like the employee grid: the band names
                        what a group of columns is for. */}
                    <thead className="sticky top-0 z-30 bg-fill">
                      <tr>
                        <th
                          rowSpan={2}
                          className={cn(
                            "sticky left-0 z-40 min-w-[180px] max-w-[220px] border-b border-line bg-fill px-2.5 py-[9px] text-left text-[10.5px] font-semibold leading-tight text-ink-500",
                            stickyShadow,
                          )}
                        >
                          Kontraktori
                        </th>
                        <th className={thBand} colSpan={6}>
                          Paga &amp; orët {editable ? "· redaktueshme" : "· vetëm lexim"}
                        </th>
                        <th className={cn(thBand, "border-l border-line")} colSpan={3}>
                          Baza · nga profili
                        </th>
                        <th
                          rowSpan={2}
                          className={cn(
                            "sticky right-0 z-40 min-w-[100px] border-b border-l border-line bg-fill px-1.5 py-[9px] text-right text-[10.5px] font-bold leading-tight text-ink-900",
                            stickyShadowRight,
                          )}
                        >
                          Pagesa
                        </th>
                      </tr>
                      <tr>
                        <th className={thNum}>Paga fikse</th>
                        {HOUR_COLUMNS.map((c) => (
                          <th key={c.key} className={thNum}>
                            {c.label}
                          </th>
                        ))}
                        <th className={cn(thNum, "border-l border-line")}>Baza</th>
                        <th className={thNum}>Tarifa/orë</th>
                        <th className={thNum}>Burimi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detail.entries.map((e) => {
                        const flat = e.payBasis === "MONTHLY_FLAT";
                        return (
                          <tr key={e.id} className="group border-b border-fill transition-colors hover:bg-fill-faint">
                            <td
                              className={cn(
                                "sticky left-0 z-20 min-w-[180px] max-w-[220px] bg-white px-2.5 py-2 align-middle transition-colors group-hover:bg-fill-faint",
                                stickyShadow,
                              )}
                            >
                              <div className="truncate text-[12.5px] font-semibold leading-tight text-ink-900">
                                {e.lastName}, {e.firstName}
                              </div>
                              <div className="truncate text-[9.5px] font-normal leading-tight text-ink-400">
                                {e.personalId}
                              </div>
                            </td>

                            {/* Inputs — fee first, then the five hour buckets. */}
                            <td className={tdInput}>
                              {flat ? (
                                <ContractorCell
                                  disabled={!editable}
                                  periodId={detail.id}
                                  entry={e}
                                  field="monthlyFlatAmount"
                                  onSaved={markSaved}
                                />
                              ) : (
                                <span className="block text-right text-xs text-ink-300">—</span>
                              )}
                            </td>
                            {HOUR_COLUMNS.map((c) => (
                              <td key={c.key} className={tdInput}>
                                {flat && c.key === "regularHours" ? (
                                  <span
                                    className="block text-right text-xs text-ink-300"
                                    title="Përfshirë në pagën fikse"
                                  >
                                    —
                                  </span>
                                ) : (
                                  <ContractorCell
                                    disabled={!editable}
                                    periodId={detail.id}
                                    entry={e}
                                    field={c.key}
                                    onSaved={markSaved}
                                  />
                                )}
                              </td>
                            ))}

                            {/* Derived — from the profile, read-only. */}
                            <td className={cn(tdNum, "border-l border-line-soft")}>
                              {flat ? "Mujore fikse" : "Orë"}
                            </td>
                            <td className={tdNum}>
                              {flat ? (
                                "—"
                              ) : Number(e.hourlyRate) > 0 ? (
                                `€${e.hourlyRate}`
                              ) : (
                                <span className="font-semibold text-tone-danger-fg">mungon</span>
                              )}
                            </td>
                            <td className={cn(tdNum, "whitespace-nowrap")}>
                              <span className="inline-flex items-center gap-1.5">
                                {e.hoursSource === "TIMECLOCK" ? "Ora e punës" : "Manual"}
                                {editable && !flat ? (
                                  <button
                                    type="button"
                                    title="Plotëso orët nga ora e punës"
                                    disabled={busyRow === e.id}
                                    onClick={() => void syncRow(e.id)}
                                    className="inline-flex h-6 w-6 items-center justify-center rounded-md text-ink-400 transition-colors hover:bg-fill hover:text-ink-700 disabled:opacity-50"
                                  >
                                    <Clock3 className="h-3.5 w-3.5" aria-hidden />
                                  </button>
                                ) : null}
                              </span>
                            </td>

                            <td
                              className={cn(
                                "sticky right-0 z-20 min-w-[100px] whitespace-nowrap border-l border-line-soft bg-white px-1.5 py-1.5 text-right text-xs font-bold text-ink-900 transition-colors [font-variant-numeric:tabular-nums] group-hover:bg-fill-faint",
                                stickyShadowRight,
                              )}
                            >
                              €{e.grossPay}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot className="sticky bottom-0 z-30 bg-fill">
                      <tr className="border-t border-line">
                        <td
                          className={cn(
                            "sticky left-0 z-40 min-w-[180px] max-w-[220px] bg-fill px-2.5 py-[9px] text-xs font-bold text-ink-900",
                            stickyShadow,
                          )}
                        >
                          Totalet ({detail.entries.length} rreshta)
                        </td>
                        <td className={footCell} colSpan={6} />
                        <td className={cn(footCell, "border-l border-line")} colSpan={3} />
                        <td
                          className={cn(
                            "sticky right-0 z-40 min-w-[100px] whitespace-nowrap border-l border-line bg-fill px-1.5 py-[9px] text-right text-xs font-extrabold text-brand-blue-strong [font-variant-numeric:tabular-nums]",
                            stickyShadowRight,
                          )}
                        >
                          €{footPay}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

              <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1 px-0.5 text-[11.5px] text-ink-400">
                <span>{detail.entries.length} rreshta · vetëm kontraktorë</span>
                <span>Paga fikse mbulon orët e rregullta; shtesë/vikend/festë/natë paguhen me premium sipër saj</span>
                {!editable ? <span>redaktimi aktiv vetëm në DRAFT</span> : null}
                {savedAt ? (
                  <span className="text-[#047857]">
                    Ruajtur {savedAt.toLocaleTimeString("sq-AL", { hour: "2-digit", minute: "2-digit" })}
                  </span>
                ) : null}
              </div>
            </div>

            {/* Mobile — the employee grid's card pattern. */}
            <div className="space-y-2 md:hidden">
              {detail.entries.map((e) => {
                const flat = e.payBasis === "MONTHLY_FLAT";
                return (
                  <div key={e.id} className="rounded-xl border border-line bg-white p-3 shadow-card">
                    <div className="flex items-baseline justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold leading-tight text-ink-900">
                          {e.lastName}, {e.firstName}
                        </p>
                        <p className="text-[11px] text-ink-400">
                          {flat ? "Mujore fikse" : `Orë · €${e.hourlyRate}`}
                        </p>
                      </div>
                      <p className="text-right text-sm font-bold text-brand-blue-strong [font-variant-numeric:tabular-nums]">
                        €{e.grossPay}
                      </p>
                    </div>
                    {editable ? (
                      <div className="mt-2 grid gap-1.5 border-t border-line-soft pt-2">
                        {flat ? (
                          <div className="grid grid-cols-[1fr_minmax(4rem,5.5rem)] items-center gap-x-2 text-[11px]">
                            <span className="leading-tight text-ink-500">Paga fikse</span>
                            <ContractorCell
                              disabled={false}
                              periodId={detail.id}
                              entry={e}
                              field="monthlyFlatAmount"
                              onSaved={markSaved}
                            />
                          </div>
                        ) : null}
                        {HOUR_COLUMNS.filter((c) => !(flat && c.key === "regularHours")).map((c) => (
                          <div
                            key={c.key}
                            className="grid grid-cols-[1fr_minmax(4rem,5.5rem)] items-center gap-x-2 text-[11px]"
                          >
                            <span className="leading-tight text-ink-500">{c.label}</span>
                            <ContractorCell
                              disabled={false}
                              periodId={detail.id}
                              entry={e}
                              field={c.key}
                              onSaved={markSaved}
                            />
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </>
  );
}
