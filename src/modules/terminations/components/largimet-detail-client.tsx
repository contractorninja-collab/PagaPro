"use client";

import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { useCan } from "@/components/layout/capability-provider";
import type { ReactNode } from "react";
import type { TerminationStatus, TerminationType } from "@prisma/client";
import { Banknote, CalendarDays, Check, FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import { StatusPill } from "@/components/patterns/status-pill";
import { AppSubBar, SubBarStatus } from "@/components/layout/app-sub-bar";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  approveTerminationAction,
  cancelTerminationAction,
  completeTerminationAction,
  generateTerminationDocumentActionServer,
  prepareFinalPayrollTerminationAction,
  submitTerminationAction,
  updateTerminationAction,
} from "@/modules/terminations/actions/termination-actions";
import { TERMINATION_STATUS_LABELS, TERMINATION_TYPE_LABELS } from "@/modules/terminations/types";
import {
  EMPLOYMENT_STATUS_LABELS,
  formatEur,
  formatSqDate,
} from "@/modules/employees/components/employees-labels";
import { formatArtifactKind } from "@/modules/documents/components/document-labels";

export interface LargimetDetailProps {
  termination: {
    id: string;
    type: TerminationType;
    status: TerminationStatus;
    terminationDate: string;
    noticeDate: string | null;
    lastWorkingDay: string;
    noticeDays: number | null;
    severanceAmount: string | null;
    reason: string | null;
    details: string | null;
    finalPayrollRequired: boolean;
    finalPayrollId: string | null;
    generatedDocumentId: string | null;
    completedAt: string | null;
    approvedAt: string | null;
    employee: {
      id: string;
      firstName: string;
      lastName: string;
      personalId: string;
      jobTitle: string | null;
      hireDate: string;
      status: string;
      department: { id: string; name: string } | null;
    };
    approvedBy: { displayName: string | null; email: string } | null;
    createdBy: { displayName: string | null; email: string } | null;
    finalPayroll: { id: string; year: number; month: number; status: string } | null;
    generatedDocument: { id: string; displayFilename: string } | null;
  };
  artifacts: Array<{
    id: string;
    title: string;
    displayFilename: string;
    kind: string;
    createdAt: string;
    isArchived: boolean;
  }>;
  payrollEntry: { id: string; status: string; netPay: string; grossSalary: string } | null;
  timeline: Array<{ id: string; eventType: string; title: string; body: string | null; occurredAt: string }>;
  activities: Array<{
    id: string;
    verb: string;
    summary: string;
    occurredAt: string;
    actor: { displayName: string | null; email: string } | null;
  }>;
  audits: Array<{
    id: string;
    action: string;
    createdAt: string | null;
    actor: { displayName: string | null; email: string } | null;
  }>;
}

function fmtDateTime(iso: string) {
  try {
    return new Date(iso).toLocaleString("sq-AL", { timeZone: "UTC" });
  } catch {
    return iso;
  }
}

/* ── 1b design primitives (module-local) ─────────────────────────────── */

const CARD =
  "rounded-[12px] border border-line bg-white shadow-card";
const CARD_TITLE = "text-[14px] font-bold tracking-[-0.01em] text-ink-900";

const BTN_PRIMARY = buttonVariants({ size: "default" });
const BTN_SECONDARY = buttonVariants({ variant: "secondary", size: "default" });
const BTN_DESTRUCTIVE = buttonVariants({ variant: "destructiveOutline", size: "default" });

const FIELD_LABEL = "text-[11px] font-bold uppercase tracking-[0.04em] text-ink-400";
const FIELD_SELECT =
  "h-10 w-full rounded-[8px] border border-line bg-white px-2.5 text-[13px] text-ink-700 outline-none transition-colors focus:border-brand-blue";
const FIELD_INPUT =
  "h-10 w-full rounded-[8px] border border-line bg-white px-2.5 text-[13px] text-ink-700 outline-none transition-colors focus:border-brand-blue";
const FIELD_TEXTAREA =
  "min-h-[72px] w-full rounded-[8px] border border-line bg-white px-3 py-2 text-[13px] text-ink-700 outline-none transition-colors focus:border-brand-blue";

type ChipTone = "info" | "success" | "warning" | "destructive" | "neutral" | "locked";

function Chip({ tone, children, className }: { tone: ChipTone; children: ReactNode; className?: string }) {
  return (
    <StatusPill tone={tone} className={className}>
      {children}
    </StatusPill>
  );
}

const STATUS_TONE: Record<string, ChipTone> = {
  DRAFT: "neutral",
  PENDING_REVIEW: "warning",
  APPROVED: "info",
  COMPLETED: "success",
  CANCELLED: "destructive",
};

// Mirrors the Albanian labels/tones of PayrollStatusBadge (payroll module).
const PAYROLL_STATUS_META: Record<string, { label: string; tone: ChipTone }> = {
  DRAFT: { label: "Draft", tone: "warning" },
  REVIEWED: { label: "Në shqyrtim", tone: "info" },
  APPROVED: { label: "I miratuar", tone: "success" },
  LOCKED: { label: "I kyçur", tone: "locked" },
  ARCHIVED: { label: "I arkivuar", tone: "neutral" },
};

const EMPLOYEE_STATUS_TONE: Record<string, ChipTone> = {
  ACTIVE: "success",
  INACTIVE: "neutral",
  ON_LEAVE: "info",
  SUSPENDED: "warning",
  TERMINATED: "destructive",
};

/* ── Stage pipeline ───────────────────────────────────────────────────── */

const PIPELINE_STAGES: Array<{ key: TerminationStatus; label: string }> = [
  { key: "DRAFT", label: "Krijuar" },
  { key: "PENDING_REVIEW", label: "Në shqyrtim" },
  { key: "APPROVED", label: "I miratuar" },
  { key: "COMPLETED", label: "I përfunduar" },
];

const PIPELINE_INDEX: Record<string, number> = {
  DRAFT: 0,
  PENDING_REVIEW: 1,
  APPROVED: 2,
  COMPLETED: 3,
};

function StagePipeline({ status }: { status: TerminationStatus }) {
  const cancelled = status === "CANCELLED";
  const current = cancelled ? -1 : (PIPELINE_INDEX[status] ?? 0);
  const completed = status === "COMPLETED";

  return (
    <div className={cn(CARD, "px-5 py-4")}>
      <div className="overflow-x-auto">
        <div className="flex min-w-[560px] items-center gap-2">
          {PIPELINE_STAGES.map((stage, i) => {
            const done = !cancelled && (completed || i < current);
            const active = !cancelled && !completed && i === current;
            return (
              <div key={stage.key} className={cn("flex items-center gap-2", i < PIPELINE_STAGES.length - 1 && "flex-1")}>
                <div className="flex items-center gap-2.5">
                  <span
                    className={cn(
                      "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[12px] font-bold",
                      done && "bg-brand-blue text-white",
                      active && "border-2 border-brand-blue bg-[#eff6ff] text-brand-blue",
                      !done && !active && "border border-line bg-white text-ink-400",
                    )}
                    aria-hidden
                  >
                    {done ? <Check className="h-3.5 w-3.5" /> : i + 1}
                  </span>
                  <span
                    className={cn(
                      "whitespace-nowrap text-[12.5px] font-semibold",
                      done || active ? "text-ink-900" : "text-ink-400",
                    )}
                  >
                    {stage.label}
                  </span>
                </div>
                {i < PIPELINE_STAGES.length - 1 ? (
                  <span
                    className={cn("h-[2px] min-w-[24px] flex-1 rounded-full", done ? "bg-brand-blue" : "bg-line")}
                    aria-hidden
                  />
                ) : null}
              </div>
            );
          })}
          {cancelled ? (
            <Chip tone="destructive" className="ml-2 shrink-0">
              {TERMINATION_STATUS_LABELS.CANCELLED}
            </Chip>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/* ── Cockpit ──────────────────────────────────────────────────────────── */

export function LargimetDetailClient(props: LargimetDetailProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const t = props.termination;
  const readOnly = t.status === "COMPLETED" || t.status === "CANCELLED";
  /**
   * Three capabilities meet in this one action bar. The termination workflow
   * itself is employees.write; the document button is documents.write; the
   * payroll button is payroll.prepare. An HR_MANAGER holds all three, a
   * READ_ONLY member none, but they are separate answers and asking once would
   * be wrong for anyone in between.
   */
  const canWriteEmployees = useCan("employees.write");
  const canWriteDocuments = useCan("documents.write");
  const canPreparePayroll = useCan("payroll.prepare");

  function run(labelOk: string, fn: () => Promise<{ ok: boolean; error?: string }>) {
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) toast.error(res.error ?? "Gabim.");
      else {
        toast.success(labelOk);
        router.refresh();
      }
    });
  }

  const initials = `${t.employee.firstName?.[0] ?? ""}${t.employee.lastName?.[0] ?? ""}`.toUpperCase();
  const employeeStatusLabel =
    EMPLOYMENT_STATUS_LABELS[t.employee.status as keyof typeof EMPLOYMENT_STATUS_LABELS] ?? t.employee.status;

  return (
    <>
      <AppSubBar
        dense
        backHref="/largimet"
        backLabel="Largimet"
        title={`${t.employee.firstName} ${t.employee.lastName}`}
        description={`${TERMINATION_TYPE_LABELS[t.type]} · ${formatSqDate(t.terminationDate)}`}
        status={
          <SubBarStatus tone={STATUS_TONE[t.status] ?? "neutral"}>
            {TERMINATION_STATUS_LABELS[t.status] ?? t.status}
          </SubBarStatus>
        }
        actions={
          !readOnly ? (
            <EditTerminationDialog termination={t} pending={pending} startTransition={startTransition} onSaved={() => router.refresh()} />
          ) : undefined
        }
      />

      <div className="space-y-5">
        {/* Stage pipeline */}
        <StagePipeline status={t.status} />

        {/* Identity header */}
        <div className={cn(CARD, "p-5")}>
          <div className="flex flex-wrap items-center gap-4">
            <span
              className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-brand-navy text-[18px] font-bold text-white"
              aria-hidden
            >
              {initials}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                <Link
                  href={`/punonjesit/${t.employee.id}`}
                  className="text-[18px] font-bold tracking-[-0.02em] text-ink-900 transition-colors hover:text-brand-blue"
                >
                  {t.employee.firstName} {t.employee.lastName}
                </Link>
                <Chip tone={EMPLOYEE_STATUS_TONE[t.employee.status] ?? "neutral"}>{employeeStatusLabel}</Chip>
                <Chip tone="neutral">{TERMINATION_TYPE_LABELS[t.type]}</Chip>
              </div>
              <p className="mt-1 text-[13px] text-ink-500">
                {t.employee.jobTitle ?? "—"} · {t.employee.department?.name ?? "—"} ·{" "}
                <span className="tabular-nums">Punësuar {formatSqDate(t.employee.hireDate)}</span> ·{" "}
                <span className="tabular-nums">{t.employee.personalId}</span>
              </p>
            </div>
            <Link href={`/punonjesit/${t.employee.id}`} className={BTN_SECONDARY}>
              Profili
            </Link>
          </div>
        </div>

        {/* Two-column body */}
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
          {/* Left — main column */}
          <div className="min-w-0 space-y-5">

            {/* Final payroll + severance */}
            <div className={cn(CARD, "p-5")}>
              <div className="flex items-center justify-between gap-3">
                <h2 className={CARD_TITLE}>Final payroll & severanca</h2>
                <Chip tone={t.finalPayrollRequired ? "info" : "neutral"}>
                  {t.finalPayrollRequired ? "I detyrueshëm" : "Jo i detyrueshëm"}
                </Chip>
              </div>
              {t.finalPayroll ? (
                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <span className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-[10px] bg-[#eff6ff] text-brand-blue">
                    <Banknote className="h-[18px] w-[18px]" aria-hidden />
                  </span>
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/pagat/${t.finalPayroll.id}`}
                      className="text-[13.5px] font-semibold tabular-nums text-brand-blue hover:underline"
                    >
                      Pagë {t.finalPayroll.month}/{t.finalPayroll.year}
                    </Link>
                    {props.payrollEntry ? (
                      <p className="mt-0.5 text-[12.5px] text-ink-500">
                        Rreshti: {props.payrollEntry.status} · Bruto{" "}
                        <span className="font-semibold tabular-nums text-[#111827]">
                          {formatEur(props.payrollEntry.grossSalary)}
                        </span>{" "}
                        · Neto{" "}
                        <span className="font-semibold tabular-nums text-[#111827]">
                          {formatEur(props.payrollEntry.netPay)}
                        </span>
                      </p>
                    ) : null}
                  </div>
                  <Chip
                    tone={(PAYROLL_STATUS_META[t.finalPayroll.status]?.tone ?? "neutral") as ChipTone}
                  >
                    {PAYROLL_STATUS_META[t.finalPayroll.status]?.label ?? t.finalPayroll.status}
                  </Chip>
                </div>
              ) : (
                <p className="mt-3 text-[13px] text-ink-500">Nuk është lidhur ende.</p>
              )}
              <div className="mt-4 flex items-center justify-between border-t border-fill pt-3 text-[13px]">
                <span className="text-ink-500">Severanca</span>
                <span className="font-semibold tabular-nums text-[#111827]">
                  {t.severanceAmount != null ? formatEur(t.severanceAmount) : "—"}
                </span>
              </div>
            </div>

            {/* Generated documents */}
            <div className={cn(CARD, "p-5")}>
              <div className="flex items-center justify-between gap-3">
                <h2 className={CARD_TITLE}>Dokumentet e gjeneruara</h2>
                <Chip tone="neutral">{props.artifacts.length}</Chip>
              </div>
              {props.artifacts.length === 0 ? (
                <p className="mt-3 text-[13px] text-ink-500">Nuk ka dokumente të gjeneruara.</p>
              ) : (
                <ul className="mt-2">
                  {props.artifacts.map((a) => (
                    <li
                      key={a.id}
                      className="flex flex-wrap items-center gap-3 border-b border-fill py-3 last:border-0 last:pb-0"
                    >
                      <span className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[10px] bg-fill text-ink-600">
                        <FileText className="h-4 w-4" aria-hidden />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px] font-semibold text-[#111827]">{a.displayFilename}</p>
                        <p className="mt-0.5 text-[12px] tabular-nums text-ink-400">{fmtDateTime(a.createdAt)}</p>
                      </div>
                      <Chip tone={a.kind === "PREVIEW" ? "warning" : "success"} className="uppercase tracking-[0.03em]">
                        {formatArtifactKind(a.kind)}
                      </Chip>
                      {a.isArchived ? <Chip tone="neutral">I arkivuar</Chip> : null}
                      <Link href={`/dokumentet/${a.id}`} className={cn(BTN_SECONDARY, "h-8 px-3 text-[12.5px]")}>
                        Hap
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Dates & legal reason */}
            <div className={cn(CARD, "p-5")}>
              <div className="flex items-center gap-2.5">
                <span className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[10px] bg-[#eff6ff] text-brand-blue">
                  <CalendarDays className="h-4 w-4" aria-hidden />
                </span>
                <h2 className={CARD_TITLE}>Datat & arsyeja ligjore</h2>
              </div>
              <dl className="mt-4 grid gap-x-6 gap-y-3 text-[13px] sm:grid-cols-2">
                <div className="flex items-center justify-between gap-3 border-b border-fill pb-2">
                  <dt className="text-ink-500">Data e largimit</dt>
                  <dd className="font-semibold tabular-nums text-[#111827]">{formatSqDate(t.terminationDate)}</dd>
                </div>
                <div className="flex items-center justify-between gap-3 border-b border-fill pb-2">
                  <dt className="text-ink-500">Dita e fundit e punës</dt>
                  <dd className="font-semibold tabular-nums text-[#111827]">{formatSqDate(t.lastWorkingDay)}</dd>
                </div>
                <div className="flex items-center justify-between gap-3 border-b border-fill pb-2">
                  <dt className="text-ink-500">Njoftimi</dt>
                  <dd className="font-semibold tabular-nums text-[#111827]">
                    {t.noticeDate ? formatSqDate(t.noticeDate) : "—"}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-3 border-b border-fill pb-2">
                  <dt className="text-ink-500">Ditë njoftimi</dt>
                  <dd className="font-semibold tabular-nums text-[#111827]">{t.noticeDays ?? "—"}</dd>
                </div>
              </dl>
              <div className="mt-4">
                <p className={FIELD_LABEL}>Arsyeja</p>
                <p className="mt-1.5 whitespace-pre-wrap text-[13px] leading-relaxed text-ink-700">{t.reason ?? "—"}</p>
                {t.details ? (
                  <>
                    <p className={cn(FIELD_LABEL, "mt-4")}>Detaje</p>
                    <p className="mt-1.5 whitespace-pre-wrap text-[13px] leading-relaxed text-ink-700">{t.details}</p>
                  </>
                ) : null}
              </div>
            </div>
          </div>

          {/* Right — summary rail */}
          <div className="min-w-0 space-y-5">
            <div className={cn(CARD, "p-5")}>
              <h2 className={CARD_TITLE}>Përmbledhje</h2>
              <dl className="mt-3 space-y-2.5 text-[13px]">
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-ink-500">Statusi</dt>
                  <dd>
                    <Chip tone={STATUS_TONE[t.status] ?? "neutral"}>
                      {TERMINATION_STATUS_LABELS[t.status] ?? t.status}
                    </Chip>
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-3 border-t border-fill pt-2.5">
                  <dt className="text-ink-500">Lloji</dt>
                  <dd className="font-medium text-[#111827]">{TERMINATION_TYPE_LABELS[t.type]}</dd>
                </div>
                <div className="flex items-center justify-between gap-3 border-t border-fill pt-2.5">
                  <dt className="text-ink-500">Krijuar nga</dt>
                  <dd className="truncate font-medium text-[#111827]">
                    {t.createdBy?.displayName ?? t.createdBy?.email ?? "—"}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-3 border-t border-fill pt-2.5">
                  <dt className="text-ink-500">Miratuar nga</dt>
                  <dd className="truncate font-medium text-[#111827]">
                    {t.approvedBy?.displayName ?? t.approvedBy?.email ?? "—"}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-3 border-t border-fill pt-2.5">
                  <dt className="text-ink-500">Miratuar më</dt>
                  <dd className="font-medium tabular-nums text-[#111827]">
                    {t.approvedAt ? fmtDateTime(t.approvedAt) : "—"}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-3 border-t border-fill pt-2.5">
                  <dt className="text-ink-500">Përfunduar më</dt>
                  <dd className="font-medium tabular-nums text-[#111827]">
                    {t.completedAt ? fmtDateTime(t.completedAt) : "—"}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-3 border-t border-fill pt-2.5">
                  <dt className="text-ink-500">Final payroll</dt>
                  <dd className="font-medium text-[#111827]">{t.finalPayrollRequired ? "Po" : "Jo"}</dd>
                </div>
              </dl>
            </div>

            {/* Activity timeline */}
            <div className={cn(CARD, "p-5")}>
              <h2 className={CARD_TITLE}>Aktiviteti</h2>
              {props.activities.length === 0 ? (
                <p className="mt-3 text-[13px] text-ink-500">Nuk ka aktivitet të regjistruar.</p>
              ) : (
                <ul className="mt-3">
                  {props.activities.map((a, i) => (
                    <li key={a.id} className="relative flex gap-3 pb-4 last:pb-0">
                      {i < props.activities.length - 1 ? (
                        <span className="absolute left-[5px] top-4 h-full w-px bg-fill-hover" aria-hidden />
                      ) : null}
                      <span className="relative mt-1.5 h-[11px] w-[11px] shrink-0 rounded-full border-2 border-white bg-brand-blue shadow-[0_0_0_1px_#dbeafe]" aria-hidden />
                      <div className="min-w-0">
                        <p className="text-[13px] font-medium leading-snug text-[#111827]">{a.summary}</p>
                        <p className="mt-0.5 text-[12px] text-ink-400">
                          <span className="tabular-nums">{fmtDateTime(a.occurredAt)}</span> ·{" "}
                          {a.actor?.displayName ?? a.actor?.email ?? "—"}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className={cn(CARD, "p-5")}>
              <h2 className={CARD_TITLE}>Timeline (punonjësi)</h2>
              {props.timeline.length === 0 ? (
                <p className="mt-3 text-[13px] text-ink-500">Nuk ka ngjarje.</p>
              ) : (
                <ul className="mt-2">
                  {props.timeline.map((ev) => (
                    <li key={ev.id} className="border-b border-fill py-2.5 last:border-0 last:pb-0">
                      <p className="text-[13px] font-medium text-[#111827]">{ev.title}</p>
                      <p className="mt-0.5 text-[12px] tabular-nums text-ink-400">{fmtDateTime(ev.occurredAt)}</p>
                      {ev.body ? (
                        <p className="mt-1 whitespace-pre-wrap text-[12.5px] leading-relaxed text-ink-500">{ev.body}</p>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className={cn(CARD, "p-5")}>
              <h2 className={CARD_TITLE}>Audit log</h2>
              {props.audits.length === 0 ? (
                <p className="mt-3 text-[13px] text-ink-500">Nuk ka regjistrime.</p>
              ) : (
                <ul className="mt-2">
                  {props.audits.map((a) => (
                    <li key={a.id} className="border-b border-fill py-2.5 last:border-0 last:pb-0">
                      <p className="text-[12.5px] font-semibold text-[#111827]">{a.action}</p>
                      <p className="mt-0.5 text-[12px] text-ink-400">
                        <span className="tabular-nums">{a.createdAt ? fmtDateTime(a.createdAt) : "—"}</span> ·{" "}
                        {a.actor?.displayName ?? "—"}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Sticky action bar */}
      <div className="sticky bottom-[calc(4.5rem_+_env(safe-area-inset-bottom))] z-30 -mx-4 mt-6 border-t border-line bg-white/95 px-4 py-3 shadow-[0_-4px_16px_rgba(15,23,42,0.06)] backdrop-blur md:bottom-0 md:-mx-10 md:px-10">
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="mr-auto flex items-center gap-2">
            <Chip tone={STATUS_TONE[t.status] ?? "neutral"}>{TERMINATION_STATUS_LABELS[t.status] ?? t.status}</Chip>
          </div>
          <button
            type="button"
            className={BTN_SECONDARY}
            disabled={pending || readOnly || !canWriteEmployees || t.status !== "DRAFT"}
            onClick={() => run("U dërgua.", () => submitTerminationAction({ id: t.id }))}
          >
            Dërgo në shqyrtim
          </button>
          <button
            type="button"
            className={BTN_SECONDARY}
            disabled={pending || readOnly || !canWriteEmployees || t.status !== "PENDING_REVIEW"}
            onClick={() => run("U miratua.", () => approveTerminationAction({ id: t.id }))}
          >
            Mirato
          </button>
          <button
            type="button"
            className={BTN_SECONDARY}
            disabled={pending || readOnly || !canWriteDocuments}
            onClick={() => run("U gjenerua.", () => generateTerminationDocumentActionServer({ id: t.id }))}
          >
            Gjenero dokument
          </button>
          <button
            type="button"
            className={BTN_SECONDARY}
            disabled={pending || readOnly || !canPreparePayroll}
            onClick={() => run("U përgatit.", () => prepareFinalPayrollTerminationAction({ id: t.id }))}
          >
            Përgatit payroll
          </button>
          <button
            type="button"
            className={BTN_DESTRUCTIVE}
            disabled={pending || readOnly || !canWriteEmployees}
            onClick={() => run("U anulua.", () => cancelTerminationAction({ id: t.id }))}
          >
            Anulo
          </button>
          <button
            type="button"
            className={BTN_PRIMARY}
            disabled={pending || readOnly || !canWriteEmployees || t.status !== "APPROVED"}
            onClick={() => run("U përfundua.", () => completeTerminationAction({ id: t.id }))}
          >
            Përfundo largimin
          </button>
        </div>
      </div>
    </>
  );
}

function EditTerminationDialog(props: {
  termination: LargimetDetailProps["termination"];
  pending: boolean;
  startTransition: (fn: () => void) => void;
  onSaved: () => void;
}) {
  const { termination: t, pending, startTransition, onSaved } = props;
  const [open, setOpen] = useState(false);
  const [type, setType] = useState(t.type);
  const [terminationDate, setTerminationDate] = useState(t.terminationDate.slice(0, 10));
  const [lastWorkingDay, setLastWorkingDay] = useState(t.lastWorkingDay.slice(0, 10));
  const [reason, setReason] = useState(t.reason ?? "");
  const [details, setDetails] = useState(t.details ?? "");
  const [finalPayrollRequired, setFinalPayrollRequired] = useState(t.finalPayrollRequired);

  function save() {
    startTransition(async () => {
      const res = await updateTerminationAction({
        id: t.id,
        type,
        terminationDate: new Date(`${terminationDate}T12:00:00.000Z`).toISOString(),
        lastWorkingDay: new Date(`${lastWorkingDay}T12:00:00.000Z`).toISOString(),
        reason,
        details,
        finalPayrollRequired,
      });
      if (!res.ok) toast.error(res.error);
      else {
        toast.success("U ruajt.");
        setOpen(false);
        onSaved();
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button type="button" className={BTN_SECONDARY}>
          Edito
        </button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edito largimin</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3 py-2">
          <div className="space-y-1.5">
            <label className={FIELD_LABEL}>Lloji</label>
            <select className={FIELD_SELECT} value={type} onChange={(e) => setType(e.target.value as TerminationType)}>
              {(Object.keys(TERMINATION_TYPE_LABELS) as TerminationType[]).map((k) => (
                <option key={k} value={k}>
                  {TERMINATION_TYPE_LABELS[k]}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <label className={FIELD_LABEL}>Data largimit</label>
              <input
                type="date"
                className={FIELD_INPUT}
                value={terminationDate}
                onChange={(e) => setTerminationDate(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <label className={FIELD_LABEL}>Dita e fundit</label>
              <input
                type="date"
                className={FIELD_INPUT}
                value={lastWorkingDay}
                onChange={(e) => setLastWorkingDay(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <label className={FIELD_LABEL}>Arsyeja</label>
            <textarea className={FIELD_TEXTAREA} value={reason} onChange={(e) => setReason(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <label className={FIELD_LABEL}>Detaje</label>
            <textarea className={FIELD_TEXTAREA} value={details} onChange={(e) => setDetails(e.target.value)} />
          </div>
          <label className="flex items-center gap-2 text-[13px] text-ink-700">
            <input
              type="checkbox"
              className="h-4 w-4 accent-[#2563EB]"
              checked={finalPayrollRequired}
              onChange={(e) => setFinalPayrollRequired(e.target.checked)}
            />
            Final payroll i detyrueshëm
          </label>
        </div>
        <DialogFooter>
          <button type="button" className={BTN_PRIMARY} onClick={save} disabled={pending}>
            Ruaj
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
