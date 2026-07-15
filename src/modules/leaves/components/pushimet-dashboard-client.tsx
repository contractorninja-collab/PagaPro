"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { CalendarDays, CheckCircle2, Clock, FileText, Plus, type LucideIcon } from "lucide-react";
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
import { LeaveRequestsMobileList } from "@/modules/leaves/components/leave-requests-mobile-list";
import { LeaveRequestsTable } from "@/modules/leaves/components/leave-requests-table";
import {
  BTN_DESTRUCTIVE_DENSE,
  BTN_PRIMARY,
  BTN_PRIMARY_DENSE,
  InitialsAvatar,
  LEAVE_CARD,
  LEAVE_TYPE_TONES,
  LeaveTypePill,
  MICRO_LABEL,
  TonePill,
  type SemanticTone,
} from "@/modules/leaves/components/leave-ui";
import { formatSqDate } from "@/modules/employees/components/employees-labels";
import type { LeaveSubtype } from "@prisma/client";
import {
  approveLeaveRequestAction,
  cancelLeaveRequestAction,
  createLeaveRequestAction,
  generateLeaveDocumentAction,
  rejectLeaveRequestAction,
} from "@/modules/leaves/actions/leave-actions";
import {
  LEAVE_TYPE_HELP_SQ,
  LEAVE_TYPE_LABELS_SQ,
  LEAVE_SUBTYPE_LABELS_SQ,
  medicalLeaveSubtypeLabel,
  subtypesForLeaveType,
} from "@/modules/leaves/helpers/leave-type-metadata";
import type {
  PushimetBalanceRowDto,
  PushimetCalendarChipDto,
  PushimetEmployeeOptionDto,
  PushimetLeaveRowDto,
  PushimetTemplateOptionDto,
} from "@/modules/leaves/types/pushimet";

function shiftMonth(year: number, month: number, delta: number): { year: number; month: number } {
  const d = new Date(Date.UTC(year, month - 1 + delta, 1));
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1 };
}

function utcDayStartMs(iso: string): number {
  const d = new Date(iso);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

const STAT_TONES: Record<SemanticTone, string> = {
  info: "bg-[#eff6ff] text-brand-blue",
  success: "bg-[#ecfdf5] text-[#15803d]",
  warning: "bg-[#fffbeb] text-[#b45309]",
  destructive: "bg-[#fef2f2] text-[#dc2626]",
  neutral: "bg-[#f1f5f9] text-[#64748b]",
};

function StatCard({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string;
  value: number;
  icon: LucideIcon;
  tone: SemanticTone;
}) {
  return (
    <div className={`flex items-center gap-3.5 p-4 ${LEAVE_CARD}`}>
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
    </div>
  );
}

type ConflictFlag = { key: string; label: string; tone: SemanticTone };

export function PushimetDashboardClient(props: {
  stats: { pending: number; approvedThisUtcMonth: number; draft: number };
  rows: PushimetLeaveRowDto[];
  pendingRows: PushimetLeaveRowDto[];
  chips: PushimetCalendarChipDto[];
  calendarYear: number;
  calendarMonth: number;
  balances: PushimetBalanceRowDto[];
  employees: PushimetEmployeeOptionDto[];
  templates: PushimetTemplateOptionDto[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pendingUi, startTransition] = useTransition();

  const [rejectId, setRejectId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const [genId, setGenId] = useState<string | null>(null);
  const [genTemplateId, setGenTemplateId] = useState(props.templates[0]?.id ?? "");

  const [newOpen, setNewOpen] = useState(false);
  const [newForm, setNewForm] = useState({
    employeeId: "",
    type: "PUSHIM_VJETOR" as PushimetLeaveRowDto["type"],
    subtype: "NONE" as LeaveSubtype,
    startDateIso: "",
    endDateIso: "",
    reason: "",
  });

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

  /** Approved chips overlapping today (UTC), deduplicated by employee — "Sot në pushim". */
  const todayOff = useMemo(() => {
    const now = new Date();
    const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
    const seen = new Set<string>();
    const list: PushimetCalendarChipDto[] = [];
    for (const c of props.chips) {
      if (c.status !== "APPROVED") continue;
      if (today < utcDayStartMs(c.startDateIso) || today > utcDayStartMs(c.endDateIso)) continue;
      if (seen.has(c.employeeId)) continue;
      seen.add(c.employeeId);
      list.push(c);
    }
    return list;
  }, [props.chips]);

  const balanceIndex = useMemo(() => {
    const m = new Map<string, PushimetBalanceRowDto>();
    for (const b of props.balances) m.set(`${b.employeeId}:${b.leaveType}`, b);
    return m;
  }, [props.balances]);

  function conflictFlags(row: PushimetLeaveRowDto): ConflictFlag[] {
    const flags: ConflictFlag[] = [];
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

  function refresh() {
    startTransition(() => router.refresh());
  }

  async function runApprove(id: string) {
    const r = await approveLeaveRequestAction(id);
    if (!r.ok) {
      toast.error(r.error);
      return;
    }
    toast.success("Pushimi u miratua.");
    refresh();
  }

  async function runCancel(id: string) {
    const r = await cancelLeaveRequestAction(id);
    if (!r.ok) {
      toast.error(r.error);
      return;
    }
    toast.success("Kërkesa u anulua.");
    refresh();
  }

  async function confirmReject() {
    if (!rejectId) return;
    const r = await rejectLeaveRequestAction({
      leaveId: rejectId,
      rejectionReason: rejectReason.trim() || undefined,
    });
    if (!r.ok) {
      toast.error(r.error);
      return;
    }
    toast.success("Pushimi u refuzua.");
    setRejectId(null);
    setRejectReason("");
    refresh();
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

  async function submitNewLeave(e: React.FormEvent) {
    e.preventDefault();
    if (!newForm.employeeId || !newForm.startDateIso || !newForm.endDateIso) {
      toast.error("Plotësoni punonjësin dhe datat.");
      return;
    }
    const r = await createLeaveRequestAction({
      employeeId: newForm.employeeId,
      type: newForm.type,
      subtype: newForm.subtype,
      startDateIso: newForm.startDateIso,
      endDateIso: newForm.endDateIso,
      reason: newForm.reason.trim() || null,
    });
    if (!r.ok || !r.data?.id) {
      toast.error(!r.ok ? r.error : "Ruajtja dështoi.");
      return;
    }
    toast.success("Kërkesa u dërgua për miratim.");
    setNewOpen(false);
    refresh();
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

      {/* 5a — 4-stat strip */}
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Në pritje" value={props.stats.pending} icon={Clock} tone="warning" />
        <StatCard
          label="Miratuar këtë muaj"
          value={props.stats.approvedThisUtcMonth}
          icon={CheckCircle2}
          tone="success"
        />
        <StatCard label="Sot në pushim" value={todayOff.length} icon={CalendarDays} tone="info" />
        <StatCard label="Draft" value={props.stats.draft} icon={FileText} tone="neutral" />
      </section>

      <section className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_340px] xl:grid-cols-[minmax(0,1fr)_380px]">
        {/* Left column — approvals queue, operative list, calendar */}
        <div className="min-w-0 space-y-6">
          <div className={`overflow-hidden ${LEAVE_CARD}`}>
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#eef2f7] px-5 py-4">
              <div className="min-w-0">
                <h2 className="flex items-center gap-2 text-[13.5px] font-bold tracking-[-0.01em] text-[#0f172a]">
                  Miratimet në pritje
                  {props.pendingRows.length > 0 ? (
                    <TonePill tone="warning" size="sm">
                      {props.pendingRows.length}
                    </TonePill>
                  ) : null}
                </h2>
                <p className="mt-0.5 text-[12px] text-[#64748b]">
                  Operacion HR — reflektohet menjëherë në payroll pas miratimit.
                </p>
              </div>
              <button
                type="button"
                className={`hidden md:inline-flex ${BTN_PRIMARY}`}
                onClick={() => setNewOpen(true)}
              >
                <Plus className="h-4 w-4" aria-hidden />
                Kërkesë e re
              </button>
            </div>
            {props.pendingRows.length === 0 ? (
              <p className="px-5 py-8 text-center text-[13px] text-[#64748b]">
                Nuk ka kërkesa në pritje.
              </p>
            ) : (
              <ul className="divide-y divide-[#f1f5f9]">
                {props.pendingRows.map((row) => {
                  const flags = conflictFlags(row);
                  return (
                    <li
                      key={row.id}
                      className="flex flex-col gap-3 px-5 py-3.5 transition-colors hover:bg-[#f8fafc] sm:flex-row sm:items-center"
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
                          {flags.length > 0 ? (
                            <div className="mt-1.5 flex flex-wrap gap-1.5">
                              {flags.map((f) => (
                                <TonePill key={f.key} tone={f.tone} size="sm">
                                  {f.label}
                                </TonePill>
                              ))}
                            </div>
                          ) : null}
                        </div>
                      </div>
                      <div className="flex shrink-0 flex-wrap items-center gap-2 sm:justify-end">
                        <button
                          type="button"
                          className={BTN_PRIMARY_DENSE}
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
                        <Link
                          href={`/pushimet/${row.id}`}
                          className="text-[12.5px] font-semibold text-[#64748b] transition-colors hover:text-brand-blue"
                        >
                          Hape
                        </Link>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-[13.5px] font-bold tracking-[-0.01em] text-[#0f172a]">
                Lista operative
              </h2>
              <p className="text-[12px] text-[#94a3b8]">Filtrimi aplikon për tabelë dhe kalendar.</p>
            </div>
            <LeaveRequestsTable
              rows={props.rows}
              onApprove={(id) => void runApprove(id)}
              onReject={(id) => setRejectId(id)}
              onCancel={(id) => void runCancel(id)}
              onGenerate={(id) => openGenerate(id)}
            />
            <LeaveRequestsMobileList
              rows={props.rows}
              onApprove={(id) => void runApprove(id)}
              onReject={(id) => setRejectId(id)}
              onCancel={(id) => void runCancel(id)}
              onGenerate={(id) => openGenerate(id)}
            />
          </div>

          {/* 5b — month calendar */}
          <LeaveOperationalCalendar
            year={props.calendarYear}
            month={props.calendarMonth}
            chips={props.chips.filter((c) => c.status === "APPROVED" || c.status === "PENDING")}
            prevHref={prevHref}
            nextHref={nextHref}
          />
        </div>

        {/* Right rail — balances, other quotas, who's off today */}
        <div className="min-w-0 space-y-6">
          <AnnualLeaveBalancePanel balances={props.balances} year={props.calendarYear} />

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

      <Dialog open={rejectId != null} onOpenChange={(o) => !o && setRejectId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Refuzo kërkesën</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">Mesazhi përfshihet në audit dhe në kronologjinë e punonjësit.</p>
          <textarea
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            rows={4}
            placeholder="Arsyeja e refuzimit…"
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="ghost" onClick={() => setRejectId(null)}>
              Anulo
            </Button>
            <Button type="button" onClick={() => void confirmReject()}>
              Konfirmo refuzimin
            </Button>
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

      <Dialog open={newOpen} onOpenChange={setNewOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Kërkesë e re për pushim</DialogTitle>
          </DialogHeader>
          <form className="space-y-4" onSubmit={(e) => void submitNewLeave(e)}>
            <div className="space-y-1">
              <label htmlFor="nl-emp" className="text-xs font-medium text-muted-foreground">
                Punonjësi
              </label>
              <select
                id="nl-emp"
                required
                value={newForm.employeeId}
                onChange={(e) => setNewForm((s) => ({ ...s, employeeId: e.target.value }))}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="">Zgjidh…</option>
                {props.employees.map((em) => (
                  <option key={em.id} value={em.id}>
                    {em.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label htmlFor="nl-type" className="text-xs font-medium text-muted-foreground">
                Lloji
              </label>
              <select
                id="nl-type"
                value={newForm.type}
                onChange={(e) =>
                  setNewForm((s) => ({
                    ...s,
                    type: e.target.value as PushimetLeaveRowDto["type"],
                    subtype: "NONE",
                  }))
                }
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {(Object.keys(LEAVE_TYPE_LABELS_SQ) as PushimetLeaveRowDto["type"][]).map((k) => (
                  <option key={k} value={k}>
                    {LEAVE_TYPE_LABELS_SQ[k]}
                  </option>
                ))}
              </select>
              {newForm.type === "PUSHIM_MJEKESOR" && LEAVE_TYPE_HELP_SQ.PUSHIM_MJEKESOR ? (
                <p className="text-xs leading-relaxed text-muted-foreground">{LEAVE_TYPE_HELP_SQ.PUSHIM_MJEKESOR}</p>
              ) : null}
            </div>
            <div className="space-y-1">
              <label htmlFor="nl-subtype" className="text-xs font-medium text-muted-foreground">
                {newForm.type === "PUSHIM_MJEKESOR" ? "Nën-lloji mjekësor" : "Nën-lloji (Art 39 / Atersi / Lehonie)"}
              </label>
              <select
                id="nl-subtype"
                value={newForm.subtype}
                onChange={(e) => setNewForm((s) => ({ ...s, subtype: e.target.value as LeaveSubtype }))}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {subtypesForLeaveType(newForm.type).map((k) => (
                  <option key={k} value={k}>
                    {newForm.type === "PUSHIM_MJEKESOR" ? medicalLeaveSubtypeLabel(k) : LEAVE_SUBTYPE_LABELS_SQ[k]}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <label htmlFor="nl-start" className="text-xs font-medium text-muted-foreground">
                  Fillimi
                </label>
                <input
                  id="nl-start"
                  required
                  type="date"
                  value={newForm.startDateIso}
                  onChange={(e) => setNewForm((s) => ({ ...s, startDateIso: e.target.value }))}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </div>
              <div className="space-y-1">
                <label htmlFor="nl-end" className="text-xs font-medium text-muted-foreground">
                  Mbarimi
                </label>
                <input
                  id="nl-end"
                  required
                  type="date"
                  value={newForm.endDateIso}
                  onChange={(e) => setNewForm((s) => ({ ...s, endDateIso: e.target.value }))}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </div>
            </div>
            <div className="space-y-1">
              <label htmlFor="nl-reason" className="text-xs font-medium text-muted-foreground">
                Arsyeja / shënim
              </label>
              <textarea
                id="nl-reason"
                rows={3}
                value={newForm.reason}
                onChange={(e) => setNewForm((s) => ({ ...s, reason: e.target.value }))}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button type="button" variant="ghost" onClick={() => setNewOpen(false)}>
                Anulo
              </Button>
              <Button type="submit">Dërgo për miratim</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <div className="fixed bottom-24 right-4 z-40 md:hidden">
        <Button type="button" size="lg" className="shadow-lg" onClick={() => setNewOpen(true)}>
          + Pushim
        </Button>
      </div>
    </div>
  );
}
