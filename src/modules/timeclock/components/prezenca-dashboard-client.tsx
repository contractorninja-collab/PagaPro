"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { useCan } from "@/components/layout/capability-provider";
import { AlarmClock, AlertTriangle, ChevronLeft, ChevronRight, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  listDayPunchesAction,
  syncTimeClockMonthToPayrollAction,
} from "@/modules/timeclock/actions/timeclock-actions";
import type { TimeClockSyncAccount } from "@/modules/payroll/services/payroll-timeclock-sync-service";
import type {
  PresenceMonthDto,
  PresencePunchDto,
} from "@/modules/timeclock/services/timeclock-presence-service";
import { PrezencaResolveDialog } from "@/modules/timeclock/components/prezenca-resolve-dialog";

const CARD = "rounded-xl border border-[#e2e8f0] bg-white shadow-card";
const NAV_BTN =
  "inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[#e2e8f0] bg-white text-[#334155] transition-colors hover:bg-[#eef2f7]";
const MICRO = "text-[10.5px] font-bold uppercase tracking-[0.05em] text-[#94a3b8]";

const h = (minutes: number): string => (minutes / 60).toFixed(1).replace(/\.0$/, "");

function shiftMonth(year: number, month: number, delta: number): { year: number; month: number } {
  const d = new Date(Date.UTC(year, month - 1 + delta, 1));
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1 };
}

function hhmm(iso: string | null): string {
  if (!iso) return "—";
  return iso.slice(11, 16);
}

export function PrezencaDashboardClient(props: {
  presence: PresenceMonthDto;
  payrollStatus: string | null;
  todayIso: string;
}) {
  const { presence } = props;
  const router = useRouter();
  const searchParams = useSearchParams();

  const [resolveTarget, setResolveTarget] = useState<{
    employeeId: string;
    employeeName: string;
    workDateIso: string;
    reviewReason: string | null;
    punches: PresencePunchDto[];
  } | null>(null);
  /**
   * Resolving a punch is timeclock.write, but syncing the month into payroll is
   * payroll.prepare — syncTimeClockMonthToPayrollAction asks for that one. The
   * two sit on the same screen and are not the same permission.
   */
  const canWriteTimeclock = useCan("timeclock.write");
  const canPreparePayroll = useCan("payroll.prepare");
  const [resolveLoading, setResolveLoading] = useState<string | null>(null);

  const [syncOpen, setSyncOpen] = useState(false);
  const [syncRunning, setSyncRunning] = useState(false);
  const [syncAccount, setSyncAccount] = useState<TimeClockSyncAccount | null>(null);

  const stepHref = (delta: number): string => {
    const { year, month } = shiftMonth(presence.year, presence.month, delta);
    const p = new URLSearchParams(searchParams.toString());
    p.set("year", String(year));
    p.set("month", String(month));
    return `/prezenca?${p.toString()}`;
  };

  const monthLabel = new Date(Date.UTC(presence.year, presence.month - 1, 1)).toLocaleDateString(
    "sq-AL",
    { month: "long", year: "numeric", timeZone: "UTC" },
  );

  const daysInMonth = new Date(Date.UTC(presence.year, presence.month, 0)).getUTCDate();
  const dayNumbers = useMemo(
    () => Array.from({ length: daysInMonth }, (_, i) => i + 1),
    [daysInMonth],
  );

  const isWeekendCol = (day: number): boolean => {
    const dow = new Date(Date.UTC(presence.year, presence.month - 1, day)).getUTCDay();
    return dow === 0 || dow === 6;
  };
  const isoOf = (day: number): string =>
    `${presence.year}-${String(presence.month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

  async function openResolve(exception: {
    employeeId: string;
    employeeName: string;
    workDateIso: string;
    reviewReason: string | null;
  }) {
    const key = `${exception.employeeId}:${exception.workDateIso}`;
    setResolveLoading(key);
    try {
      const r = await listDayPunchesAction({
        employeeId: exception.employeeId,
        workDateIso: exception.workDateIso,
      });
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      setResolveTarget({ ...exception, punches: r.data ?? [] });
    } finally {
      setResolveLoading(null);
    }
  }

  async function runSync() {
    if (syncRunning) return;
    setSyncRunning(true);
    try {
      const r = await syncTimeClockMonthToPayrollAction({
        year: presence.year,
        month: presence.month,
      });
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      setSyncAccount(r.data ?? null);
      router.refresh();
    } finally {
      setSyncRunning(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* header band — month stepper + totals + sync */}
      <div className={`flex flex-wrap items-center justify-between gap-x-6 gap-y-3 px-4 py-3 ${CARD}`}>
        <div className="flex items-center gap-2">
          <Link href={stepHref(-1)} prefetch={false} aria-label="Muaji paraprak" className={NAV_BTN}>
            <ChevronLeft className="h-4 w-4" aria-hidden />
          </Link>
          <h2 className="min-w-[128px] text-center text-[13.5px] font-bold capitalize tracking-[-0.01em] text-[#0f172a]">
            {monthLabel}
          </h2>
          <Link href={stepHref(1)} prefetch={false} aria-label="Muaji tjetër" className={NAV_BTN}>
            <ChevronRight className="h-4 w-4" aria-hidden />
          </Link>
        </div>

        <dl className="flex items-stretch divide-x divide-[#eef2f7]">
          <div className="px-4 first:pl-0">
            <dt className={MICRO}>Punonjës me skanime</dt>
            <dd className="mt-0.5 text-[19px] font-extrabold leading-none tabular-nums text-[#0f172a]">
              {presence.totals.employees}
            </dd>
          </div>
          <div className="px-4">
            <dt className={MICRO}>Orë të punuara</dt>
            <dd className="mt-0.5 text-[19px] font-extrabold leading-none tabular-nums text-[#0f172a]">
              {h(presence.totals.workedMinutes)}
            </dd>
          </div>
          <div className="px-4">
            <dt className={MICRO}>Orë shtesë</dt>
            <dd className="mt-0.5 text-[19px] font-extrabold leading-none tabular-nums text-[#0f172a]">
              {h(presence.totals.overtimeMinutes)}
            </dd>
          </div>
          <div className="px-4 last:pr-0">
            <dt className={MICRO}>Për rishikim</dt>
            <dd
              className={`mt-0.5 text-[19px] font-extrabold leading-none tabular-nums ${
                presence.totals.reviewDays > 0 ? "text-[#b45309]" : "text-[#0f172a]"
              }`}
            >
              {presence.totals.reviewDays}
            </dd>
          </div>
        </dl>

        <Button
          type="button"
          disabled={presence.employees.length === 0}
          title={
            props.payrollStatus === null
              ? "Nuk ka payroll për këtë muaj"
              : props.payrollStatus !== "DRAFT"
                ? `Payroll-i është ${props.payrollStatus} — vetëm DRAFT sinkronizohet`
                : undefined
          }
          onClick={() => {
            setSyncAccount(null);
            setSyncOpen(true);
          }}
        >
          <RefreshCw className="mr-1.5 h-4 w-4" aria-hidden />
          Sinkronizo me payroll
        </Button>
      </div>

      {/* exception queue — first, because sync refuses employees with open days */}
      {presence.exceptions.length > 0 ? (
        <div className={`overflow-hidden ${CARD}`}>
          <div className="flex items-center gap-2 border-b border-[#eef2f7] px-5 py-3.5">
            <AlertTriangle className="h-4 w-4 text-[#b45309]" aria-hidden />
            <h2 className="text-[13.5px] font-bold tracking-[-0.01em] text-[#0f172a]">
              Ditë për rishikim
            </h2>
            <span className="rounded-full bg-[#fffbeb] px-2 py-0.5 text-[11px] font-bold text-[#b45309]">
              {presence.exceptions.length}
            </span>
            <p className="ml-auto text-[12px] text-[#94a3b8]">
              Orët e këtyre ditëve nuk llogariten derisa të zgjidhen
            </p>
          </div>
          <ul className="divide-y divide-[#f1f5f9]">
            {presence.exceptions.map((ex) => {
              const key = `${ex.employeeId}:${ex.workDateIso}`;
              return (
                <li key={key} className="flex flex-wrap items-center gap-3 px-5 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-semibold text-[#0f172a]">
                      {ex.employeeName}
                      <span className="ml-2 font-normal tabular-nums text-[#64748b]">
                        {ex.workDateIso.split("-").reverse().join(".")}
                        {ex.firstInAtIso ? ` · hyrja ${hhmm(ex.firstInAtIso)}` : ""}
                      </span>
                    </p>
                    <p className="mt-0.5 text-[12px] text-[#b45309]">{ex.reviewReason}</p>
                  </div>
                  <button
                    type="button"
                    disabled={resolveLoading === key || !canWriteTimeclock}
                    onClick={() => void openResolve(ex)}
                    className="inline-flex h-8 items-center rounded-lg border border-[#e2e8f0] bg-white px-3 text-[12.5px] font-semibold text-[#334155] transition-colors hover:bg-[#eef2f7] disabled:opacity-60"
                  >
                    {resolveLoading === key ? "Duke hapur…" : "Zgjidh…"}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}

      {/* the month grid */}
      <div className={`overflow-hidden ${CARD}`}>
        {presence.employees.length === 0 ? (
          <div className="px-5 py-12 text-center">
            <AlarmClock className="mx-auto h-8 w-8 text-[#cbd5e1]" aria-hidden />
            <p className="mt-3 text-sm font-semibold text-[#0f172a]">
              Asnjë skanim për {monthLabel}.
            </p>
            <p className="mx-auto mt-1 max-w-md text-[13px] text-[#64748b]">
              Ditët shfaqen këtu sapo punonjësit të skanojnë kartelat në kiosk.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <div className="min-w-[940px]">
              {/* day header */}
              <div
                className="grid h-9 border-b border-[#eef2f7]"
                style={{ gridTemplateColumns: `220px repeat(${daysInMonth}, minmax(24px, 1fr)) 88px` }}
              >
                <div className="sticky left-0 z-[3] flex items-center border-r border-[#eef2f7] bg-white px-3">
                  <span className={MICRO}>Punonjësi</span>
                </div>
                {dayNumbers.map((d) => (
                  <div
                    key={d}
                    className={`flex items-center justify-center text-[10.5px] font-semibold tabular-nums ${
                      isWeekendCol(d) ? "bg-[#fbfcfe] text-[#cbd5e1]" : "text-[#94a3b8]"
                    } ${isoOf(d) === props.todayIso ? "shadow-[inset_2px_0_0_#2563EB]" : ""}`}
                  >
                    {d}
                  </div>
                ))}
                <div className="flex items-center justify-end border-l border-[#eef2f7] pr-3">
                  <span className={MICRO}>Orë</span>
                </div>
              </div>

              {presence.employees.map((emp) => {
                const byDay = new Map(emp.days.map((d) => [d.workDateIso, d]));
                return (
                  <div
                    key={emp.employeeId}
                    className="grid border-b border-[#f6f8fb] hover:bg-[#fbfcfe]"
                    style={{
                      gridTemplateColumns: `220px repeat(${daysInMonth}, minmax(24px, 1fr)) 88px`,
                      height: 44,
                    }}
                  >
                    <div className="sticky left-0 z-[3] flex min-w-0 flex-col justify-center border-r border-[#eef2f7] bg-white px-3">
                      <Link
                        href={`/punonjesit/${emp.employeeId}`}
                        className="truncate text-[12.5px] font-semibold text-[#0f172a] hover:underline"
                      >
                        {emp.name}
                      </Link>
                      {emp.flags.length > 0 ? (
                        <span className="flex flex-wrap gap-1">
                          {emp.flags.map((f, i) => (
                            <span
                              key={i}
                              title={f.detail}
                              className={`rounded px-1 text-[9.5px] font-bold uppercase tracking-wide ${
                                f.severity === "warn"
                                  ? "bg-[#fef2f2] text-[#dc2626]"
                                  : "bg-[#eff6ff] text-brand-blue"
                              }`}
                            >
                              {f.article}
                            </span>
                          ))}
                        </span>
                      ) : (
                        <span className="truncate text-[10.5px] text-[#94a3b8]">
                          {emp.jobTitle ?? emp.departmentName ?? ""}
                        </span>
                      )}
                    </div>
                    {dayNumbers.map((d) => {
                      const day = byDay.get(isoOf(d));
                      const weekend = isWeekendCol(d);
                      if (!day) {
                        return (
                          <div
                            key={d}
                            className={`${weekend ? "bg-[#fbfcfe]" : ""} ${
                              isoOf(d) === props.todayIso ? "shadow-[inset_2px_0_0_#2563EB]" : ""
                            }`}
                          />
                        );
                      }
                      const review = day.status === "NEEDS_REVIEW";
                      return (
                        <div
                          key={d}
                          title={
                            review
                              ? `${emp.name} · ${day.reviewReason ?? "Për rishikim"}`
                              : `${emp.name} · ${h(day.workedMinutes)} orë · ${hhmm(day.firstInAtIso)}–${hhmm(day.lastOutAtIso)}`
                          }
                          className={`flex items-center justify-center text-[10.5px] font-semibold tabular-nums ${
                            review
                              ? "bg-[#fffbeb] text-[#b45309]"
                              : day.holidayMinutes > 0
                                ? "bg-[#fef9c3] text-[#854d0e]"
                                : weekend
                                  ? "bg-[#eff6ff] text-brand-blue"
                                  : "bg-[#ecfdf5] text-[#15803d]"
                          } ${isoOf(d) === props.todayIso ? "shadow-[inset_2px_0_0_#2563EB]" : ""}`}
                        >
                          {review ? "!" : h(day.workedMinutes)}
                        </div>
                      );
                    })}
                    <div className="flex flex-col items-end justify-center border-l border-[#eef2f7] pr-3">
                      <span className="text-[12px] font-bold tabular-nums text-[#0f172a]">
                        {h(emp.totals.workedMinutes)}
                      </span>
                      {emp.totals.overtimeMinutes > 0 ? (
                        <span className="text-[10px] tabular-nums text-[#b45309]">
                          +{h(emp.totals.overtimeMinutes)} shtesë
                        </span>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* legend */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-[#eef2f7] px-4 py-2.5 text-[11px] font-medium text-[#64748b]">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-[3px] bg-[#ecfdf5] ring-1 ring-inset ring-[#a7f3d0]" aria-hidden />
            Ditë pune
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-[3px] bg-[#eff6ff] ring-1 ring-inset ring-[#bfdbfe]" aria-hidden />
            Vikend i punuar
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-[3px] bg-[#fef9c3] ring-1 ring-inset ring-[#fde68a]" aria-hidden />
            Festë e punuar
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-[3px] bg-[#fffbeb] ring-1 ring-inset ring-[#fde68a]" aria-hidden />
            Për rishikim
          </span>
          <span className="ml-auto text-[#94a3b8]">
            Etiketat Neni 23/27/30/31 tregojnë kufijtë e Ligjit të Punës — kaloni kursorin për detaje
          </span>
        </div>
      </div>

      <PrezencaResolveDialog
        target={resolveTarget}
        onClose={() => setResolveTarget(null)}
        onResolved={() => {
          setResolveTarget(null);
          router.refresh();
        }}
      />

      {/* sync confirm/result */}
      <Dialog
        open={syncOpen}
        onOpenChange={(o) => {
          if (!o && !syncRunning) {
            setSyncOpen(false);
            setSyncAccount(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {syncAccount
                ? "Rezultati i sinkronizimit"
                : `Sinkronizo orët e ${monthLabel} me payroll?`}
            </DialogTitle>
          </DialogHeader>

          {syncAccount ? (
            <div className="space-y-3 text-sm">
              <p>
                {syncAccount.synced.length === 1
                  ? "1 punonjës u sinkronizua."
                  : `${syncAccount.synced.length} punonjës u sinkronizuan.`}
                {syncAccount.skipped.length > 0 ? (
                  <span className="ml-1 font-semibold text-[#b45309]">
                    {syncAccount.skipped.length} u kapërcyen:
                  </span>
                ) : null}
              </p>
              {syncAccount.skipped.length > 0 ? (
                <ul className="max-h-56 space-y-2 overflow-y-auto">
                  {syncAccount.skipped.map((s) => (
                    <li
                      key={s.employeeId}
                      className="rounded-lg border border-[#fde68a] bg-[#fffbeb] px-3 py-2 text-[12.5px]"
                    >
                      <p className="font-semibold text-[#854d0e]">{s.employeeName}</p>
                      <p className="mt-0.5 text-[#92400e]">{s.reason}</p>
                    </li>
                  ))}
                </ul>
              ) : null}
              {syncAccount.synced.length > 0 ? (
                <p className="text-[12px] text-[#64748b]">
                  Orët dhe shumat u rillogaritën në payroll-in DRAFT {syncAccount.month}/
                  {syncAccount.year}.{" "}
                  <Link
                    href={`/pagat/${syncAccount.payrollId}`}
                    className="font-semibold text-brand-blue hover:underline"
                  >
                    Hape payroll-in
                  </Link>
                </p>
              ) : null}
            </div>
          ) : (
            <div className="space-y-2 text-sm text-[#334155]">
              <p>
                Për çdo punonjës me skanime këtë muaj, orët e matura (të rregullta, shtesë, vikend,
                festë, natë) zëvendësojnë vlerat në payroll-in DRAFT dhe shumat rillogariten.
              </p>
              <p className="text-[12.5px] text-[#64748b]">
                Punonjësit me ditë për rishikim kapërcehen — zgjidhini më parë. Orët e pushimeve
                dhe shtesat manuale nuk preken.
              </p>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="ghost"
              disabled={syncRunning}
              onClick={() => {
                setSyncOpen(false);
                setSyncAccount(null);
              }}
            >
              Mbyll
            </Button>
            {syncAccount ? null : (
              <Button
                type="button"
                disabled={syncRunning || !canPreparePayroll}
                onClick={() => void runSync()}
              >
                {syncRunning ? "Duke sinkronizuar…" : "Sinkronizo"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
