"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState, useTransition, type ReactNode } from "react";
import { toast } from "sonner";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  FileText,
  Info,
  RefreshCw,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { LeaveOperationalCalendar } from "@/modules/leaves/calendar/leave-operational-calendar";
import { AnnualLeaveBalancePanel } from "@/modules/leaves/components/annual-leave-balance-panel";
import type { LeaveQueueDecision } from "@/modules/leaves/services/leave-queue-decision-service";
import type { PayrollSyncSkipRow, LeaveBalanceTotals } from "@/modules/leaves/services/leave-query-service";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { LeaveRequestsMobileList } from "@/modules/leaves/components/leave-requests-mobile-list";
import { LeaveRequestsTable } from "@/modules/leaves/components/leave-requests-table";
import { LeaveRejectDialog } from "@/modules/leaves/components/leave-reject-dialog";
import {
  BTN_DESTRUCTIVE_DENSE,
  BTN_PRIMARY_DENSE,
  BTN_SECONDARY_DENSE,
  InitialsAvatar,
  LEAVE_CARD,
  LEAVE_TYPE_TONES,
  LeaveFlagPills,
  LeaveTypePill,
  MICRO_LABEL,
  TonePill,
  type LeaveConflictFlag,
  type SemanticTone,
} from "@/modules/leaves/components/leave-ui";
import { formatSqDate } from "@/modules/employees/components/employees-labels";
import {
  approveLeaveRequestAction,
  cancelLeaveRequestAction,
  generateLeaveDocumentAction,
  refreshLeaveBalancesAction,
} from "@/modules/leaves/actions/leave-actions";
import { LEAVE_TYPE_LABELS_SQ } from "@/modules/leaves/helpers/leave-type-metadata";
import type {
  PushimetBalanceRowDto,
  PushimetCalendarChipDto,
  PushimetLeaveRowDto,
  PushimetTemplateOptionDto,
} from "@/modules/leaves/types/pushimet";

function shiftMonth(year: number, month: number, delta: number): { year: number; month: number } {
  const d = new Date(Date.UTC(year, month - 1 + delta, 1));
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1 };
}

const STAT_TONES: Record<SemanticTone, string> = {
  info: "bg-[#eff6ff] text-brand-blue",
  success: "bg-[#ecfdf5] text-[#15803d]",
  warning: "bg-[#fffbeb] text-[#b45309]",
  destructive: "bg-[#fef2f2] text-[#dc2626]",
  neutral: "bg-[#f1f5f9] text-[#64748b]",
};

/**
 * A company-wide count. When `href` is given the whole tile filters the list
 * below — the numbers used to be unclickable, so seeing "7 në pritje" and then
 * finding them meant re-entering the same thing in the filter form.
 */
function StatCard({
  label,
  value,
  icon: Icon,
  tone,
  href,
}: {
  label: string;
  value: number;
  icon: LucideIcon;
  tone: SemanticTone;
  href?: string;
}) {
  const body = (
    <>
      <span
        className={`flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-[10px] ${STAT_TONES[tone]}`}
      >
        <Icon className="h-[18px] w-[18px]" aria-hidden />
      </span>
      <div className="min-w-0">
        <p className={`truncate ${MICRO_LABEL}`}>{label}</p>
        <p className="mt-0.5 text-[24px] font-extrabold leading-none tabular-nums tracking-[-0.02em] text-[#0f172a]">
          {value}
        </p>
      </div>
    </>
  );

  if (!href) {
    return <div className={`flex items-center gap-3.5 p-4 ${LEAVE_CARD}`}>{body}</div>;
  }
  return (
    <Link
      href={href}
      className={`flex items-center gap-3.5 p-4 transition-colors hover:bg-[#f8fafc] ${LEAVE_CARD}`}
    >
      {body}
    </Link>
  );
}

export function PushimetDashboardClient(props: {
  stats: { pending: number; approvedThisUtcMonth: number; draft: number };
  /** Everything that is not pending, paged. */
  rows: PushimetLeaveRowDto[];
  /** Pinned to the top and never paged — see listLeaveRequestsPage. */
  pendingRows: PushimetLeaveRowDto[];
  /** Balance, coverage, payroll state and waiting age, keyed by leave id. */
  queueDecisions: Record<string, LeaveQueueDecision>;
  /** Rows behind the payroll-sync-skip count, shown in a Sheet. */
  payrollSyncSkips: PayrollSyncSkipRow[];
  /** Company position for the year, from a DB aggregate — not the capped list. */
  balanceTotals: LeaveBalanceTotals;
  /** Computed from today on the server, not from the month being viewed. */
  onLeaveToday: PushimetLeaveRowDto[];
  chips: PushimetCalendarChipDto[];
  holidayIsoDates: string[];
  calendarYear: number;
  calendarMonth: number;
  balances: PushimetBalanceRowDto[];
  templates: PushimetTemplateOptionDto[];
  page: { page: number; pageCount: number; total: number };
  health: {
    payrollSyncSkips: number;
    lastAccrual: { year: number; month: number } | null;
  };
  /** Rendered right after the stat tiles — overview before controls. */
  filtersSlot?: ReactNode;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pendingUi, startTransition] = useTransition();

  const [rejectId, setRejectId] = useState<string | null>(null);
  const [skipsOpen, setSkipsOpen] = useState(false);

  const [genId, setGenId] = useState<string | null>(null);
  const [genTemplateId, setGenTemplateId] = useState(props.templates[0]?.id ?? "");

  /** The request currently mutating — `Mirato` had no pending state, so a
   *  double-click fired the action twice. */
  const [busyId, setBusyId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const prevHref = useMemo(() => {
    const { year, month } = shiftMonth(props.calendarYear, props.calendarMonth, -1);
    const p = new URLSearchParams(searchParams.toString());
    p.set("year", String(year));
    p.set("month", String(month));
    return `/pushimet?${p.toString()}`;
  }, [props.calendarMonth, props.calendarYear, searchParams]);

  const nextHref = useMemo(() => {
    const { year, month } = shiftMonth(props.calendarYear, props.calendarMonth, 1);
    const p = new URLSearchParams(searchParams.toString());
    p.set("year", String(year));
    p.set("month", String(month));
    return `/pushimet?${p.toString()}`;
  }, [props.calendarMonth, props.calendarYear, searchParams]);

  /**
   * Who is off today, deduplicated by employee. This used to be filtered out of
   * the calendar's chips, so paging to another month answered a question about
   * today with that month's absences.
   */
  const todayOff = useMemo(() => {
    const seen = new Set<string>();
    return props.onLeaveToday.filter((r) => {
      if (seen.has(r.employeeId)) return false;
      seen.add(r.employeeId);
      return true;
    });
  }, [props.onLeaveToday]);

  const balanceIndex = useMemo(() => {
    const m = new Map<string, PushimetBalanceRowDto>();
    for (const b of props.balances) m.set(`${b.employeeId}:${b.leaveType}`, b);
    return m;
  }, [props.balances]);

  function conflictFlags(row: PushimetLeaveRowDto): LeaveConflictFlag[] {
    const flags: LeaveConflictFlag[] = [];
    if (row.affectsPayroll) flags.push({ key: "payroll", label: "Ndikon në pagë", tone: "info" });
    const bal = balanceIndex.get(`${row.employeeId}:${row.type}`);
    if (bal) {
      const remaining = Number(bal.remainingDays);
      const requested = Number(row.workingDays ?? row.totalDays ?? "0");
      if (Number.isFinite(remaining)) {
        if (remaining < 0) {
          flags.push({
            key: "negative",
            label: `Balancë negative (${bal.remainingDays})`,
            tone: "destructive",
          });
        } else if (Number.isFinite(requested) && requested > remaining) {
          flags.push({
            key: "low",
            label: `Balancë e ulët (${bal.remainingDays} ditë)`,
            tone: "warning",
          });
        }
      }
    }
    return flags;
  }

  const otherTypeBalances = useMemo(
    () => props.balances.filter((b) => b.leaveType !== "PUSHIM_VJETOR"),
    [props.balances],
  );

  /**
   * The accrual job has no scheduler, so "posted a while ago" is the only
   * signal that nobody has run it. Two months of silence is worth a line.
   */
  const accrualStale = useMemo(() => {
    const last = props.health.lastAccrual;
    if (!last) return true;
    const now = new Date();
    const monthsBehind =
      (now.getUTCFullYear() - last.year) * 12 + (now.getUTCMonth() + 1 - last.month);
    return monthsBehind >= 2;
  }, [props.health.lastAccrual]);

  /**
   * A stat tile's filter link. Status filters are company-wide questions, so
   * they clear the employee/department/type narrowing rather than compounding
   * with it — otherwise the tile's number and the resulting list disagree.
   */
  const statusHref = (status: string, monthScoped: boolean) => {
    const now = new Date();
    const p = new URLSearchParams();
    p.set("status", status);
    p.set("year", String(now.getUTCFullYear()));
    // `0` = the whole year, so the list matches the tile instead of showing
    // only the slice that happens to fall in the month on screen.
    p.set("month", monthScoped ? String(now.getUTCMonth() + 1) : "0");
    return `/pushimet?${p.toString()}`;
  };

  const pageHref = (page: number) => {
    const p = new URLSearchParams(searchParams.toString());
    p.set("page", String(Math.max(1, page)));
    return `/pushimet?${p.toString()}`;
  };

  function refresh() {
    startTransition(() => router.refresh());
  }

  async function runApprove(id: string) {
    if (busyId) return;
    setBusyId(id);
    try {
      const r = await approveLeaveRequestAction(id);
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      toast.success("Pushimi u miratua.");
      refresh();
    } finally {
      setBusyId(null);
    }
  }

  async function runCancel(id: string) {
    if (busyId) return;
    setBusyId(id);
    try {
      const r = await cancelLeaveRequestAction(id);
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      toast.success("Kërkesa u anulua.");
      refresh();
    } finally {
      setBusyId(null);
    }
  }

  async function confirmGenerate() {
    if (!genId || !genTemplateId) {
      toast.error("Zgjidhni një shabllon dokumenti.");
      return;
    }
    const r = await generateLeaveDocumentAction({
      leaveRequestId: genId,
      documentTemplateId: genTemplateId,
    });
    if (!r.ok) {
      toast.error(r.error);
      return;
    }
    toast.success("Dokumenti u gjenerua.");
    setGenId(null);
    refresh();
  }

  async function runRefreshBalances() {
    if (refreshing) return;
    setRefreshing(true);
    try {
      const r = await refreshLeaveBalancesAction(props.calendarYear);
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      toast.success(`Balancat u rifreskuan për ${props.calendarYear}.`);
      refresh();
    } finally {
      setRefreshing(false);
    }
  }

  function openGenerate(id: string) {
    setGenTemplateId(props.templates[0]?.id ?? "");
    setGenId(id);
  }

  return (
    <div className={`space-y-6 ${pendingUi ? "opacity-80 transition-opacity" : ""}`}>
      {pendingUi ? (
        <div className="flex justify-end">
          <Skeleton className="h-4 w-24" />
        </div>
      ) : null}

      {/* Company-wide, deliberately independent of the filters below — the
          label says so rather than letting the numbers look filtered. */}
      <section className="space-y-2">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <StatCard
            label="Në pritje"
            value={props.stats.pending}
            icon={Clock}
            tone="warning"
            href={statusHref("PENDING", false)}
          />
          <StatCard
            label="Miratuar këtë muaj"
            value={props.stats.approvedThisUtcMonth}
            icon={CheckCircle2}
            tone="success"
            href={statusHref("APPROVED", true)}
          />
          <StatCard
            label="Draft"
            value={props.stats.draft}
            icon={FileText}
            tone="neutral"
            href={statusHref("DRAFT", false)}
          />
        </div>
        <p className="text-[11.5px] text-[#94a3b8]">
          Shifrat janë për gjithë kompaninë dhe nuk ndikohen nga filtrat më poshtë. Klikoni një kuti
          për ta filtruar listën.
        </p>
      </section>

      {props.filtersSlot}

      {/* Health signals, each with a control. Both of these used to be text
          that named a destination and offered no way to reach it. */}
      {props.health.payrollSyncSkips > 0 ? (
        <div
          className={`flex items-center gap-3.5 border-l-[3px] border-l-[#f59e0b] px-4 py-3 ${LEAVE_CARD}`}
        >
          <span className="grid h-[34px] w-[34px] shrink-0 place-items-center rounded-[10px] bg-[#fef3c7]">
            <AlertTriangle className="h-4 w-4 text-[#b45309]" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[13.5px] font-bold text-[#0f172a]">
              {props.health.payrollSyncSkips} ndryshime pushimi nuk arritën te payroll-i
            </p>
            <p className="text-[12.5px] text-[#64748b]">
              Orët e pushimit në ato payroll-e janë të vjetruara.
            </p>
          </div>
          <button
            type="button"
            className={BTN_SECONDARY_DENSE}
            onClick={() => setSkipsOpen(true)}
          >
            Shiko listën
          </button>
        </div>
      ) : null}

      {accrualStale ? (
        <div
          className={`flex items-center gap-3.5 border-l-[3px] border-l-[#94a3b8] px-4 py-3 ${LEAVE_CARD}`}
        >
          <span className="grid h-[34px] w-[34px] shrink-0 place-items-center rounded-[10px] bg-[#f1f5f9]">
            <Info className="h-4 w-4 text-[#64748b]" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[13.5px] font-bold text-[#0f172a]">
              {props.health.lastAccrual
                ? `Akumulimi mujor u postua së fundi për ${String(props.health.lastAccrual.month).padStart(2, "0")}/${props.health.lastAccrual.year}`
                : "Akumulimi mujor nuk është postuar asnjëherë"}
            </p>
            <p className="text-[12.5px] text-[#64748b]">Postimi bëhet manualisht te Konfigurimet.</p>
          </div>
          <Link href="/konfigurime" className={BTN_SECONDARY_DENSE}>
            Hap Konfigurimet →
          </Link>
        </div>
      ) : null}

      {/* Who, why and when — the rows behind that count. */}
      <Sheet open={skipsOpen} onOpenChange={setSkipsOpen}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Ndryshime që nuk arritën te payroll-i</SheetTitle>
          </SheetHeader>
          {props.payrollSyncSkips.length === 0 ? (
            <p className="px-1 py-6 text-[13px] text-[#64748b]">
              Asgjë për të shfaqur në 60 ditët e fundit.
            </p>
          ) : (
            <ul className="mt-2 divide-y divide-[#f1f5f9] overflow-y-auto">
              {props.payrollSyncSkips.map((s) => (
                <li key={s.id} className="py-3">
                  <p className="text-[13px] font-semibold text-[#0f172a]">{s.employeeName}</p>
                  <p className="mt-0.5 text-[12.5px] leading-relaxed text-[#64748b]">{s.reason}</p>
                  <p className="mt-1 text-[11.5px] tabular-nums text-[#94a3b8]">
                    {formatSqDate(s.occurredAtIso)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </SheetContent>
      </Sheet>

      <section className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_340px] xl:grid-cols-[minmax(0,1fr)_380px]">
        {/* Left column — one list (pending pinned), then the calendar */}
        <div className="min-w-0 space-y-6">
          {props.pendingRows.length > 0 ? (
            <div className={`overflow-hidden ${LEAVE_CARD}`}>
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#eef2f7] px-5 py-4">
                <div className="min-w-0">
                  <h2 className="flex items-center gap-2 text-[13.5px] font-bold tracking-[-0.01em] text-[#0f172a]">
                    Presin miratim
                    <TonePill tone="warning" size="sm">
                      {props.pendingRows.length}
                    </TonePill>
                  </h2>
                  <p className="mt-0.5 text-[12px] text-[#64748b]">
                    Reflektohet menjëherë në payroll pas miratimit.
                  </p>
                </div>
              </div>
              <ul className="divide-y divide-[#f1f5f9]">
                {props.pendingRows.map((row) => {
                  const flags = conflictFlags(row);
                  const d = props.queueDecisions[row.id];
                  // The rail states the worst thing about the row before it is read.
                  const rail =
                    d?.severity === "block"
                      ? "border-l-[#dc2626]"
                      : d?.severity === "warn"
                        ? "border-l-[#f59e0b]"
                        : "border-l-brand-blue";
                  return (
                    <li
                      key={row.id}
                      className={`flex flex-col gap-3 border-l-[3px] px-5 py-3.5 transition-colors hover:bg-[#f8fafc] sm:flex-row sm:items-center ${rail}`}
                    >
                      <div className="flex min-w-0 flex-1 items-start gap-3">
                        <InitialsAvatar name={row.employeeName} />
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <Link
                              href={`/pushimet/${row.id}`}
                              className="truncate text-[13.5px] font-semibold text-[#0f172a] transition-colors hover:text-brand-blue"
                            >
                              {row.employeeName}
                            </Link>
                            <LeaveTypePill type={row.type} label={LEAVE_TYPE_LABELS_SQ[row.type]} />
                          </div>
                          <p className="mt-0.5 text-[12px] tabular-nums text-[#64748b]">
                            {formatSqDate(row.startDateIso)} → {formatSqDate(row.endDateIso)}
                            {row.workingDays ?? row.totalDays
                              ? ` · ${row.workingDays ?? row.totalDays} ditë`
                              : ""}
                            {row.departmentName ? ` · ${row.departmentName}` : ""}
                          </p>
                          <LeaveFlagPills flags={flags} className="mt-1.5" />

                          {/* The three things the decision actually turns on,
                              printed rather than left behind a click. */}
                          {d ? (
                            <div className="mt-1.5 flex flex-wrap gap-1.5">
                              {d.balanceAfter != null ? (
                                <TonePill
                                  tone={d.goesNegative ? "destructive" : "neutral"}
                                  size="sm"
                                >
                                  {d.goesNegative
                                    ? `Shkon në ${d.balanceAfter} ditë`
                                    : `Mbetur ${d.balanceBefore} → ${d.balanceAfter}`}
                                </TonePill>
                              ) : null}

                              <TonePill tone="neutral" size="sm">
                                {d.departmentHeadcount != null && d.departmentLabel
                                  ? `${d.departmentOff} nga ${d.departmentHeadcount} në ${d.departmentLabel} jashtë`
                                  : `${d.departmentOff} kolegë jashtë atë periudhë`}
                              </TonePill>

                              <TonePill tone={d.payrollLocked ? "destructive" : "neutral"} size="sm">
                                {d.payrollLocked
                                  ? `Paga ${d.payrollLabel} është e kyçur — miratimi s'shkon te payroll-i`
                                  : `Prek pagën ${d.payrollLabel}`}
                              </TonePill>

                              {d.waitingDays > 0 ? (
                                <TonePill
                                  tone={d.waitingDays > 7 ? "destructive" : "neutral"}
                                  size="sm"
                                >
                                  Pret prej {d.waitingDays} ditësh
                                </TonePill>
                              ) : null}
                            </div>
                          ) : null}
                        </div>
                      </div>
                      <div className="flex shrink-0 flex-wrap items-center gap-2 sm:justify-end">
                        <button
                          type="button"
                          className={BTN_PRIMARY_DENSE}
                          disabled={busyId === row.id}
                          onClick={() => void runApprove(row.id)}
                        >
                          Mirato
                        </button>
                        <button
                          type="button"
                          className={BTN_DESTRUCTIVE_DENSE}
                          onClick={() => setRejectId(row.id)}
                        >
                          Refuzo
                        </button>
                        {/* One label for "open this request", everywhere. */}
                        <Link
                          href={`/pushimet/${row.id}`}
                          className="text-[12.5px] font-semibold text-[#64748b] transition-colors hover:text-brand-blue"
                        >
                          Shiko detajet
                        </Link>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : null}

          <div>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-[13.5px] font-bold tracking-[-0.01em] text-[#0f172a]">
                {props.pendingRows.length > 0 ? "Të vendosura" : "Kërkesat"}
              </h2>
              <p className="text-[12px] text-[#94a3b8]">
                {props.page.total} kërkesa · filtrimi aplikon edhe për kalendarin
              </p>
            </div>
            <LeaveRequestsTable
              rows={props.rows}
              flagsFor={conflictFlags}
              busyId={busyId}
              onApprove={(id) => void runApprove(id)}
              onReject={(id) => setRejectId(id)}
              onCancel={(id) => void runCancel(id)}
              onGenerate={(id) => openGenerate(id)}
            />
            <LeaveRequestsMobileList
              rows={props.rows}
              flagsFor={conflictFlags}
              busyId={busyId}
              onApprove={(id) => void runApprove(id)}
              onReject={(id) => setRejectId(id)}
              onCancel={(id) => void runCancel(id)}
              onGenerate={(id) => openGenerate(id)}
            />

            {props.page.pageCount > 1 ? (
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                <p className="text-[12px] text-[#94a3b8]">
                  Faqja {props.page.page} nga {props.page.pageCount}
                </p>
                <div className="flex items-center gap-2">
                  <Link
                    href={pageHref(props.page.page - 1)}
                    aria-disabled={props.page.page <= 1}
                    className={`${BTN_SECONDARY_DENSE} ${props.page.page <= 1 ? "pointer-events-none opacity-50" : ""}`}
                  >
                    E mëparshmja
                  </Link>
                  <Link
                    href={pageHref(props.page.page + 1)}
                    aria-disabled={props.page.page >= props.page.pageCount}
                    className={`${BTN_SECONDARY_DENSE} ${props.page.page >= props.page.pageCount ? "pointer-events-none opacity-50" : ""}`}
                  >
                    Tjetra
                  </Link>
                </div>
              </div>
            ) : null}
          </div>

          {/* 5b — month calendar */}
          <LeaveOperationalCalendar
            year={props.calendarYear}
            month={props.calendarMonth}
            chips={props.chips.filter((c) => c.status === "APPROVED" || c.status === "PENDING")}
            holidayIsoDates={props.holidayIsoDates}
            prevHref={prevHref}
            nextHref={nextHref}
          />
        </div>

        {/* Right rail — who's off today, and only that. The balance sheet and
            the other-quota table used to sit here too, which squeezed a
            company-wide table into 340px and ran it far past the bottom of the
            calendar, leaving the left column blank alongside it. Both now span
            the page below this section. */}
        <div className="min-w-0 space-y-6">
          <div className={`overflow-hidden ${LEAVE_CARD}`}>
            <div className="flex items-center justify-between gap-2 border-b border-[#eef2f7] px-4 py-3.5">
              <h2 className="text-[13.5px] font-bold tracking-[-0.01em] text-[#0f172a]">Sot në pushim</h2>
              {todayOff.length > 0 ? (
                <TonePill tone="info" size="sm">
                  {todayOff.length}
                </TonePill>
              ) : null}
            </div>
            {todayOff.length === 0 ? (
              <p className="px-4 py-6 text-center text-[13px] text-[#64748b]">
                Askush nuk është në pushim sot.
              </p>
            ) : (
              <ul className="divide-y divide-[#f1f5f9]">
                {todayOff.map((c) => {
                  const tone = LEAVE_TYPE_TONES[c.type];
                  return (
                    <li key={c.id}>
                      <Link
                        href={`/pushimet/${c.id}`}
                        className="flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-[#f8fafc]"
                      >
                        <span className={`h-2 w-2 shrink-0 rounded-full ${tone.dot}`} aria-hidden />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[13px] font-semibold text-[#0f172a]">
                            {c.employeeName}
                          </span>
                          <span className="block truncate text-[11.5px] text-[#64748b]">
                            {LEAVE_TYPE_LABELS_SQ[c.type]} · deri më {formatSqDate(c.endDateIso)}
                          </span>
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

        </div>
      </section>

      {/* Balances span the page, under the calendar — a company-wide sheet is a
          wide object, not a rail ornament. */}
      <AnnualLeaveBalancePanel
        balances={props.balances}
        companyTotals={props.balanceTotals}
        year={props.calendarYear}
        action={
          <button
            type="button"
            className={BTN_SECONDARY_DENSE}
            disabled={refreshing}
            onClick={() => void runRefreshBalances()}
            title="Rillogarit kuotat dhe mbetjet nga akumulimi dhe pushimet e miratuara"
          >
            <RefreshCw
              className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`}
              aria-hidden
            />
            Rifresko balancat
          </button>
        }
      />

      <div>
          {otherTypeBalances.length > 0 ? (
            <div className={`overflow-hidden ${LEAVE_CARD}`}>
              <div className="border-b border-[#eef2f7] px-4 py-3.5">
                <h2 className="text-[13.5px] font-bold tracking-[-0.01em] text-[#0f172a]">
                  Lloje të tjera (kuotë vjetore)
                </h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[300px] border-collapse text-[12.5px] text-[#111827]">
                  <thead>
                    <tr className="border-b border-[#eef2f7] bg-[#f8fafc]">
                      <th className="px-4 py-2 text-left text-[11px] font-bold uppercase tracking-[0.04em] text-[#94a3b8]">
                        Punonjësi
                      </th>
                      <th className="px-2 py-2 text-right text-[11px] font-bold uppercase tracking-[0.04em] text-[#94a3b8]">
                        Kuota
                      </th>
                      <th className="px-2 py-2 text-right text-[11px] font-bold uppercase tracking-[0.04em] text-[#94a3b8]">
                        Përdorur
                      </th>
                      <th className="px-4 py-2 text-right text-[11px] font-bold uppercase tracking-[0.04em] text-[#94a3b8]">
                        Mbetur
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {otherTypeBalances.map((b) => {
                      const neg = parseFloat(b.remainingDays) < 0;
                      const tone = LEAVE_TYPE_TONES[b.leaveType];
                      return (
                        <tr
                          key={b.id}
                          className="border-b border-[#f1f5f9] transition-colors last:border-0 hover:bg-[#f8fafc]"
                        >
                          <td className="px-4 py-2.5">
                            <p className="font-semibold text-[#0f172a]">{b.employeeName}</p>
                            <p className="flex items-center gap-1.5 text-[11px] text-[#64748b]">
                              <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${tone.dot}`} aria-hidden />
                              {LEAVE_TYPE_LABELS_SQ[b.leaveType]}
                            </p>
                          </td>
                          <td className="px-2 py-2.5 text-right tabular-nums text-[#64748b]">
                            {b.yearlyQuota}
                          </td>
                          <td className="px-2 py-2.5 text-right tabular-nums text-[#64748b]">
                            {b.usedDays}
                          </td>
                          <td className="px-4 py-2.5 text-right tabular-nums">
                            {neg ? (
                              <span className="font-bold text-[#dc2626]">{b.remainingDays}</span>
                            ) : (
                              <span className="font-semibold text-[#0f172a]">{b.remainingDays}</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}
      </div>

      <LeaveRejectDialog
        leaveId={rejectId}
        onOpenChange={(o) => !o && setRejectId(null)}
        onRejected={refresh}
      />

      <Dialog open={genId != null} onOpenChange={(o) => !o && setGenId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Gjenero dokumentin e pushimit</DialogTitle>
          </DialogHeader>
          {props.templates.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nuk ka shabllone aktive në kategorinë LEAVE. Ngarkoni një shabllon te Dokumentet dhe publikoni një version.
            </p>
          ) : (
            <div className="space-y-2">
              <label htmlFor="gen-template" className="text-xs font-medium text-muted-foreground">
                Shablloni
              </label>
              <select
                id="gen-template"
                value={genTemplateId}
                onChange={(e) => setGenTemplateId(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {props.templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="ghost" onClick={() => setGenId(null)}>
              Mbyll
            </Button>
            <Button type="button" disabled={props.templates.length === 0} onClick={() => void confirmGenerate()}>
              Gjenero
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}
