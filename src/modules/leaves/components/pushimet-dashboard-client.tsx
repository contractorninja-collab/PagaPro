"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState, useTransition, type ReactNode } from "react";
import { toast } from "sonner";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Download,
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
import { LeaveWallchart } from "@/modules/leaves/wallchart/leave-wallchart";
import { AnnualLeaveBalancePanel } from "@/modules/leaves/components/annual-leave-balance-panel";
import { OtherLeaveBalancePanel } from "@/modules/leaves/components/other-leave-balance-panel";
import { useCan } from "@/components/layout/capability-provider";
import type { AttentionContext } from "@/modules/leaves/helpers/leave-balance-attention";
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
  bulkApproveLeaveRequestsAction,
  cancelLeaveRequestAction,
  generateLeaveDocumentAction,
  refreshLeaveBalancesAction,
  type BulkApproveOutcome,
} from "@/modules/leaves/actions/leave-actions";
import { LEAVE_TYPE_LABELS_SQ } from "@/modules/leaves/helpers/leave-type-metadata";
import type {
  PushimetBalanceRowDto,
  PushimetCalendarChipDto,
  PushimetLeaveRowDto,
  PushimetTemplateOptionDto,
  PushimetWallchartEmployeeDto,
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
  neutral: "bg-fill text-ink-500",
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
        <p className="mt-0.5 text-[24px] font-extrabold leading-none tabular-nums tracking-[-0.02em] text-ink-900">
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
      className={`flex items-center gap-3.5 p-4 transition-colors hover:bg-fill-faint ${LEAVE_CARD}`}
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
  /** Every current employee — the wallchart also shows who is present. */
  wallchartEmployees: PushimetWallchartEmployeeDto[];
  /** UTC today as YYYY-MM-DD, decided on the server like every other date. */
  todayIso: string;
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
  /**
   * Leave policy switches, so the balance panels respect a company that turned
   * a warning off instead of showing it alerts it asked not to see.
   */
  leavePolicy: {
    splitLeaveMinWorkingDays: number;
    warnCarryOverExpiry: boolean;
    warnInsufficientBalance: boolean;
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

  /**
   * Bulk approval. Selection lives on ids, not rows — after a refresh the
   * approved ones vanish from `pendingRows` and stale ids simply stop counting.
   * The dialog is confirm-then-result: it opens to state what will happen and,
   * when anything fails, stays open with the per-request account instead of
   * compressing five different failures into one toast.
   */
  const canWriteLeave = useCan("leave.write");
  const canWriteDocuments = useCan("documents.write");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkRunning, setBulkRunning] = useState(false);
  const [bulkResult, setBulkResult] = useState<BulkApproveOutcome | null>(null);

  const selectedRows = useMemo(
    () => props.pendingRows.filter((r) => selected.has(r.id)),
    [props.pendingRows, selected],
  );

  function toggleSelected(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function runBulkApprove() {
    if (bulkRunning || selectedRows.length === 0) return;
    setBulkRunning(true);
    try {
      // Display order — startDate ascending, the order the queue argues for.
      const r = await bulkApproveLeaveRequestsAction({
        leaveIds: selectedRows.map((row) => row.id),
      });
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      const outcome = r.data;
      if (!outcome) return;
      if (outcome.failures.length === 0) {
        toast.success(
          outcome.approved === 1 ? "1 kërkesë u miratua." : `${outcome.approved} kërkesa u miratuan.`,
        );
        setBulkOpen(false);
        setSelected(new Set());
        refresh();
      } else {
        // Keep the dialog open with the account; the queue refreshes behind it.
        setBulkResult(outcome);
        setSelected(new Set(outcome.failures.map((f) => f.leaveId)));
        refresh();
      }
    } finally {
      setBulkRunning(false);
    }
  }

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

  /** Back to the current month, keeping every other filter as it is. */
  const todayMonthHref = useMemo(() => {
    const p = new URLSearchParams(searchParams.toString());
    p.delete("year");
    p.delete("month");
    p.delete("page");
    const qs = p.toString();
    return qs ? `/pushimet?${qs}` : "/pushimet";
  }, [searchParams]);

  /**
   * The export carries the filters currently on screen, minus paging — a CSV of
   * page 3 would be a surprising thing to receive. The route re-reads these with
   * the same parser the page uses, so the file matches the list.
   */
  const exportHref = useMemo(() => {
    const p = new URLSearchParams(searchParams.toString());
    p.delete("page");
    const qs = p.toString();
    return qs ? `/api/leaves/export?${qs}` : "/api/leaves/export";
  }, [searchParams]);

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

  /**
   * Shared by both balance panels. Built once here because it is the same
   * question for both, and because the panels must never read a clock of their
   * own — todayIso comes from the server for exactly that reason.
   */
  const attentionContext = useMemo<AttentionContext>(
    () => ({
      todayIso: props.todayIso,
      currentYear: Number(props.todayIso.slice(0, 4)),
      splitLeaveMinWorkingDays: props.leavePolicy.splitLeaveMinWorkingDays,
      warnCarryOverExpiry: props.leavePolicy.warnCarryOverExpiry,
      warnInsufficientBalance: props.leavePolicy.warnInsufficientBalance,
    }),
    [props.todayIso, props.leavePolicy],
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
        <p className="text-[11.5px] text-ink-400">
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
            <p className="text-[13.5px] font-bold text-ink-900">
              {props.health.payrollSyncSkips} ndryshime pushimi nuk arritën te payroll-i
            </p>
            <p className="text-[12.5px] text-ink-500">
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
          <span className="grid h-[34px] w-[34px] shrink-0 place-items-center rounded-[10px] bg-fill">
            <Info className="h-4 w-4 text-ink-500" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[13.5px] font-bold text-ink-900">
              {props.health.lastAccrual
                ? `Akumulimi mujor u postua së fundi për ${String(props.health.lastAccrual.month).padStart(2, "0")}/${props.health.lastAccrual.year}`
                : "Akumulimi mujor nuk është postuar asnjëherë"}
            </p>
            <p className="text-[12.5px] text-ink-500">Postimi bëhet manualisht te Konfigurimet.</p>
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
            <p className="px-1 py-6 text-[13px] text-ink-500">
              Asgjë për të shfaqur në 60 ditët e fundit.
            </p>
          ) : (
            <ul className="mt-2 divide-y divide-fill overflow-y-auto">
              {props.payrollSyncSkips.map((s) => (
                <li key={s.id} className="py-3">
                  <p className="text-[13px] font-semibold text-ink-900">{s.employeeName}</p>
                  <p className="mt-0.5 text-[12.5px] leading-relaxed text-ink-500">{s.reason}</p>
                  <p className="mt-1 text-[11.5px] tabular-nums text-ink-400">
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
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line-soft px-5 py-4">
                <div className="min-w-0">
                  <h2 className="flex items-center gap-2 text-[13.5px] font-bold tracking-[-0.01em] text-ink-900">
                    Presin miratim
                    <TonePill tone="warning" size="sm">
                      {props.pendingRows.length}
                    </TonePill>
                  </h2>
                  <p className="mt-0.5 text-[12px] text-ink-500">
                    Reflektohet menjëherë në payroll pas miratimit.
                  </p>
                </div>
                {props.pendingRows.length > 1 && canWriteLeave ? (
                  <div className="flex shrink-0 items-center gap-3">
                    <label className="flex cursor-pointer items-center gap-2 text-[12px] font-semibold text-ink-500">
                      <input
                        type="checkbox"
                        className="h-4 w-4 accent-[#2563EB]"
                        checked={selectedRows.length === props.pendingRows.length}
                        onChange={() =>
                          setSelected(
                            selectedRows.length === props.pendingRows.length
                              ? new Set()
                              : new Set(props.pendingRows.map((r) => r.id)),
                          )
                        }
                        aria-label="Zgjidh të gjitha kërkesat në pritje"
                      />
                      Zgjidh të gjitha
                    </label>
                    <button
                      type="button"
                      className={BTN_PRIMARY_DENSE}
                      disabled={selectedRows.length === 0}
                      onClick={() => {
                        setBulkResult(null);
                        setBulkOpen(true);
                      }}
                    >
                      Mirato të zgjedhurat ({selectedRows.length})
                    </button>
                  </div>
                ) : null}
              </div>
              <ul className="divide-y divide-fill">
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
                      className={`flex flex-col gap-3 border-l-[3px] px-5 py-3.5 transition-colors hover:bg-fill-faint sm:flex-row sm:items-center ${rail}`}
                    >
                      <div className="flex min-w-0 flex-1 items-start gap-3">
                        {props.pendingRows.length > 1 && canWriteLeave ? (
                          <input
                            type="checkbox"
                            className="mt-2.5 h-4 w-4 shrink-0 accent-[#2563EB]"
                            checked={selected.has(row.id)}
                            onChange={() => toggleSelected(row.id)}
                            aria-label={`Zgjidh kërkesën e ${row.employeeName}`}
                          />
                        ) : null}
                        <InitialsAvatar name={row.employeeName} />
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <Link
                              href={`/pushimet/${row.id}`}
                              className="truncate text-[13.5px] font-semibold text-ink-900 transition-colors hover:text-brand-blue"
                            >
                              {row.employeeName}
                            </Link>
                            <LeaveTypePill type={row.type} label={LEAVE_TYPE_LABELS_SQ[row.type]} />
                          </div>
                          <p className="mt-0.5 text-[12px] tabular-nums text-ink-500">
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
                        {canWriteLeave ? (
                          <>
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
                          </>
                        ) : null}
                        {/* One label for "open this request", everywhere. */}
                        <Link
                          href={`/pushimet/${row.id}`}
                          className="text-[12.5px] font-semibold text-ink-500 transition-colors hover:text-brand-blue"
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
              <h2 className="text-[13.5px] font-bold tracking-[-0.01em] text-ink-900">
                {props.pendingRows.length > 0 ? "Të vendosura" : "Kërkesat"}
              </h2>
              <div className="flex flex-wrap items-center gap-3">
                <p className="text-[12px] text-ink-400">
                  {props.page.total} kërkesa · filtrimi aplikon edhe për kalendarin
                </p>
                <a href={exportHref} className={BTN_SECONDARY_DENSE} download>
                  <Download className="mr-1.5 h-3.5 w-3.5" aria-hidden />
                  Shkarko CSV
                </a>
              </div>
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
                <p className="text-[12px] text-ink-400">
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

          {/* The team wallchart — rows are people, columns are days. It replaced
              the month-cell calendar, which answered "who is off on day X" one
              cell at a time and never showed who is present. */}
          <LeaveWallchart
            year={props.calendarYear}
            month={props.calendarMonth}
            employees={props.wallchartEmployees}
            chips={props.chips}
            holidayIsoDates={props.holidayIsoDates}
            todayIso={props.todayIso}
            prevHref={prevHref}
            nextHref={nextHref}
            todayHref={todayMonthHref}
          />
        </div>

        {/* Right rail — who's off today, and only that. The balance sheet and
            the other-quota table used to sit here too, which squeezed a
            company-wide table into 340px and ran it far past the bottom of the
            calendar, leaving the left column blank alongside it. Both now span
            the page below this section. */}
        <div className="min-w-0 space-y-6">
          <div className={`overflow-hidden ${LEAVE_CARD}`}>
            <div className="flex items-center justify-between gap-2 border-b border-line-soft px-4 py-3.5">
              <h2 className="text-[13.5px] font-bold tracking-[-0.01em] text-ink-900">Sot në pushim</h2>
              {todayOff.length > 0 ? (
                <TonePill tone="info" size="sm">
                  {todayOff.length}
                </TonePill>
              ) : null}
            </div>
            {todayOff.length === 0 ? (
              <p className="px-4 py-6 text-center text-[13px] text-ink-500">
                Askush nuk është në pushim sot.
              </p>
            ) : (
              <ul className="divide-y divide-fill">
                {todayOff.map((c) => {
                  const tone = LEAVE_TYPE_TONES[c.type];
                  return (
                    <li key={c.id}>
                      <Link
                        href={`/pushimet/${c.id}`}
                        className="flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-fill-faint"
                      >
                        <span className={`h-2 w-2 shrink-0 rounded-full ${tone.dot}`} aria-hidden />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[13px] font-semibold text-ink-900">
                            {c.employeeName}
                          </span>
                          <span className="block truncate text-[11.5px] text-ink-500">
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
        attention={attentionContext}
        action={
          !canWriteLeave ? null : (
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
          )
        }
      />

      <OtherLeaveBalancePanel balances={props.balances} attention={attentionContext} />

      <LeaveRejectDialog
        leaveId={rejectId}
        onOpenChange={(o) => !o && setRejectId(null)}
        onRejected={refresh}
      />

      {/* Bulk approval: confirm first, and after a partial run stay open with
          the per-request account — five different failures do not fit a toast. */}
      <Dialog
        open={bulkOpen}
        onOpenChange={(o) => {
          if (!o && !bulkRunning) {
            setBulkOpen(false);
            setBulkResult(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {bulkResult ? "Rezultati i miratimit" : `Mirato ${selectedRows.length} kërkesa?`}
            </DialogTitle>
          </DialogHeader>

          {bulkResult ? (
            <div className="space-y-3">
              <p className="text-sm">
                {bulkResult.approved === 1
                  ? "1 kërkesë u miratua."
                  : `${bulkResult.approved} kërkesa u miratuan.`}{" "}
                <span className="font-semibold text-[#dc2626]">
                  {bulkResult.failures.length === 1
                    ? "1 dështoi:"
                    : `${bulkResult.failures.length} dështuan:`}
                </span>
              </p>
              <ul className="max-h-56 space-y-2 overflow-y-auto">
                {bulkResult.failures.map((f) => {
                  const row = props.pendingRows.find((r) => r.id === f.leaveId);
                  return (
                    <li
                      key={f.leaveId}
                      className="rounded-lg border border-[#fecaca] bg-[#fef2f2] px-3 py-2 text-[12.5px]"
                    >
                      <p className="font-semibold text-[#7f1d1d]">
                        {row ? row.employeeName : "Kërkesë"}
                        {row
                          ? ` · ${formatSqDate(row.startDateIso)} → ${formatSqDate(row.endDateIso)}`
                          : ""}
                      </p>
                      <p className="mt-0.5 text-[#991b1b]">{f.error}</p>
                    </li>
                  );
                })}
              </ul>
              <p className="text-[12px] text-ink-500">
                Kërkesat e dështuara mbeten të zgjedhura në listë — trajtojini një nga një.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-ink-700">
                Çdo kërkesë miratohet veç e veç, në radhë — bilanci dhe mbivendosjet validohen për
                secilën. Nëse ndonjëra bllokohet, të tjerat vazhdojnë.
              </p>
              <ul className="max-h-56 space-y-1.5 overflow-y-auto">
                {selectedRows.map((row) => {
                  const d = props.queueDecisions[row.id];
                  return (
                    <li key={row.id} className="flex items-center justify-between gap-2 text-[12.5px]">
                      <span className="min-w-0 truncate font-medium text-ink-900">
                        {row.employeeName}
                        <span className="text-ink-400">
                          {" "}
                          · {formatSqDate(row.startDateIso)} → {formatSqDate(row.endDateIso)}
                        </span>
                      </span>
                      {d && d.severity !== "clean" ? (
                        <TonePill tone={d.severity === "block" ? "destructive" : "warning"} size="sm">
                          {d.severity === "block" ? "Bllokim" : "Kujdes"}
                        </TonePill>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="ghost"
              disabled={bulkRunning}
              onClick={() => {
                setBulkOpen(false);
                setBulkResult(null);
              }}
            >
              Mbyll
            </Button>
            {bulkResult ? null : (
              <Button type="button" disabled={bulkRunning} onClick={() => void runBulkApprove()}>
                {bulkRunning ? "Duke miratuar…" : `Mirato ${selectedRows.length}`}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
