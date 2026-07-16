"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import type { ReactNode } from "react";
import type { TerminationStatus, TerminationType } from "@prisma/client";
import { Banknote, Check, Clock, FileText, MoreHorizontal, UserMinus } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { AppSubBar } from "@/components/layout/app-sub-bar";
import { payrollMonthNameSq } from "@/modules/payroll/helpers/month-label";
import {
  createTerminationAction,
  approveTerminationAction,
  cancelTerminationAction,
  completeTerminationAction,
  generateTerminationDocumentActionServer,
  prepareFinalPayrollTerminationAction,
  submitTerminationAction,
} from "@/modules/terminations/actions/termination-actions";
import { TERMINATION_STATUS_LABELS, TERMINATION_TYPE_LABELS } from "@/modules/terminations/types";
import {
  eligibleTerminationMonths,
  eligibleTerminationYears,
} from "@/modules/terminations/helpers/eligible-termination-periods";

export interface LargimetRowSerialized {
  id: string;
  type: TerminationType;
  status: TerminationStatus;
  terminationDate: string;
  lastWorkingDay: string;
  finalPayrollRequired: boolean;
  finalPayrollId: string | null;
  generatedDocumentId: string | null;
  employee: {
    id: string;
    firstName: string;
    lastName: string;
    jobTitle: string | null;
    personalId: string;
  };
  finalPayroll: { id: string; year: number; month: number; status: string } | null;
  generatedDocument: {
    id: string;
    displayFilename: string;
  } | null;
}

export interface EmployeePickerOption {
  id: string;
  firstName: string;
  lastName: string;
  personalId: string;
  jobTitle: string | null;
  hireDate: string;
}

export type ChecklistProgressMap = Record<string, { done: number; total: number }>;

function fmtDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString("sq-AL", { timeZone: "UTC" });
  } catch {
    return iso;
  }
}

/* ── 1b design primitives (module-local) ─────────────────────────────── */

const CARD =
  "rounded-[12px] border border-[#e2e8f0] bg-white shadow-[0_1px_3px_rgba(15,23,42,0.05)]";

const BTN_PRIMARY =
  "inline-flex h-10 items-center justify-center gap-2 whitespace-nowrap rounded-[10px] bg-brand-blue px-[18px] text-[13.5px] font-semibold text-white transition-colors hover:bg-[#1d4ed8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue/40 disabled:pointer-events-none disabled:opacity-50";
const BTN_SECONDARY =
  "inline-flex h-10 items-center justify-center gap-2 whitespace-nowrap rounded-[10px] border border-[#e2e8f0] bg-white px-[18px] text-[13.5px] font-semibold text-[#334155] transition-colors hover:bg-[#eef2f7] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue/40 disabled:pointer-events-none disabled:opacity-50";
const BTN_DENSE_PRIMARY =
  "inline-flex h-8 items-center justify-center whitespace-nowrap rounded-[8px] bg-brand-blue px-3 text-[12.5px] font-semibold text-white transition-colors hover:bg-[#1d4ed8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue/40 disabled:pointer-events-none disabled:opacity-50";
const BTN_DENSE_SECONDARY =
  "inline-flex h-8 items-center justify-center whitespace-nowrap rounded-[8px] border border-[#e2e8f0] bg-white px-3 text-[12.5px] font-semibold text-[#334155] transition-colors hover:bg-[#eef2f7] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue/40 disabled:pointer-events-none disabled:opacity-50";

const FIELD_LABEL = "text-[11px] font-bold uppercase tracking-[0.05em] text-[#94a3b8]";
const FIELD_SELECT =
  "h-9 rounded-[8px] border border-[#e2e8f0] bg-white px-2.5 text-[13px] text-[#334155] outline-none transition-colors focus:border-brand-blue";
const FIELD_INPUT =
  "h-9 rounded-[8px] border border-[#e2e8f0] bg-white px-2.5 text-[13px] text-[#334155] outline-none transition-colors placeholder:text-[#94a3b8] focus:border-brand-blue";

type ChipTone = "info" | "success" | "warning" | "destructive" | "neutral" | "locked";

const CHIP_TONES: Record<ChipTone, { chip: string; dot: string }> = {
  info: { chip: "bg-[#eff6ff] text-brand-blue", dot: "bg-brand-blue" },
  success: { chip: "bg-[#ecfdf5] text-[#15803d]", dot: "bg-[#16a34a]" },
  warning: { chip: "bg-[#fffbeb] text-[#b45309]", dot: "bg-[#d97706]" },
  destructive: { chip: "bg-[#fef2f2] text-[#dc2626]", dot: "bg-[#dc2626]" },
  neutral: { chip: "bg-[#f1f5f9] text-[#64748b]", dot: "bg-[#94a3b8]" },
  locked: { chip: "bg-brand-navy text-white", dot: "bg-white" },
};

function StatusChip({
  tone,
  children,
  className,
}: {
  tone: ChipTone;
  children: ReactNode;
  className?: string;
}) {
  const t = CHIP_TONES[tone];
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center gap-1.5 whitespace-nowrap rounded-full px-[11px] text-[12px] font-semibold",
        t.chip,
        className,
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", t.dot)} aria-hidden />
      {children}
    </span>
  );
}

const TERMINATION_STATUS_TONES: Record<string, ChipTone> = {
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

function InitialsAvatar({
  firstName,
  lastName,
  className,
}: {
  firstName: string;
  lastName: string;
  className?: string;
}) {
  const initials = `${firstName?.[0] ?? ""}${lastName?.[0] ?? ""}`.toUpperCase();
  return (
    <span
      className={cn(
        "flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-navy text-[12px] font-bold text-white",
        className,
      )}
      aria-hidden
    >
      {initials}
    </span>
  );
}

function ChecklistProgress({ done, total }: { done: number; total: number }) {
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  const complete = total > 0 && done >= total;
  return (
    <div className="min-w-[96px] max-w-[130px]">
      <p className="text-[11px] font-bold tabular-nums text-[#64748b]">
        {done}/{total}
      </p>
      <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-[#eef2f7]">
        <div
          className={cn("h-full rounded-full transition-all", complete ? "bg-[#16a34a]" : "bg-brand-blue")}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

/* ── Register page ────────────────────────────────────────────────────── */

export function LargimetDashboardClient(props: {
  rows: LargimetRowSerialized[];
  employees: EmployeePickerOption[];
  filters: {
    status?: string;
    type?: string;
    employeeId?: string;
    year?: number;
    month?: number;
  };
  checklistProgress?: ChecklistProgressMap;
}) {
  const [pending, startTransition] = useTransition();
  const [createOpen, setCreateOpen] = useState(false);

  const rows = props.rows;
  const currentYear = new Date().getUTCFullYear();
  const stats = {
    inProcess: rows.filter((r) => r.status === "DRAFT" || r.status === "PENDING_REVIEW" || r.status === "APPROVED")
      .length,
    inReview: rows.filter((r) => r.status === "PENDING_REVIEW").length,
    payrollPending: rows.filter(
      (r) =>
        r.finalPayrollRequired &&
        !r.finalPayrollId &&
        r.status !== "COMPLETED" &&
        r.status !== "CANCELLED",
    ).length,
    completedYear: rows.filter(
      (r) => r.status === "COMPLETED" && new Date(r.terminationDate).getUTCFullYear() === currentYear,
    ).length,
  };

  return (
    <>
      <AppSubBar
        eyebrow="Ndërprerja e marrëdhënies"
        title="Largimet"
        description="Procesi operativ i largimeve: dokumentet, payroll përfundimtar dhe gjurmimi HR."
        actions={
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <button type="button" className={BTN_PRIMARY}>
                Krijo Largim
              </button>
            </DialogTrigger>
            <CreateTerminationDialogContent
              employees={props.employees}
              pending={pending}
              startTransition={startTransition}
              onDone={() => setCreateOpen(false)}
            />
          </Dialog>
        }
      />

      <div className="space-y-5">
        {/* 4-stat strip */}
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Në proces"
            value={stats.inProcess}
            icon={<UserMinus className="h-[18px] w-[18px]" />}
            tile="bg-[#eff6ff] text-brand-blue"
          />
          <StatCard
            label="Në shqyrtim"
            value={stats.inReview}
            icon={<Clock className="h-[18px] w-[18px]" />}
            tile="bg-[#fffbeb] text-[#b45309]"
          />
          <StatCard
            label="Payroll në pritje"
            value={stats.payrollPending}
            icon={<Banknote className="h-[18px] w-[18px]" />}
            tile="bg-[#fef2f2] text-[#dc2626]"
          />
          <StatCard
            label={`Përfunduar ${currentYear}`}
            value={stats.completedYear}
            icon={<Check className="h-[18px] w-[18px]" />}
            tile="bg-[#ecfdf5] text-[#15803d]"
          />
        </div>

        <LargimetFiltersClient filters={props.filters} employees={props.employees} />

        {rows.length === 0 ? (
          <div className="rounded-[12px] border border-dashed border-[#e2e8f0] bg-white px-6 py-16 text-center">
            <p className="text-sm font-semibold text-[#0f172a]">Nuk ka largime për këta filtra.</p>
            <p className="mt-1.5 text-[13px] text-[#64748b]">
              Ndryshoni kriteret e filtrimit ose krijoni një largim të ri.
            </p>
          </div>
        ) : (
          <>
            {/* Register table (md+) */}
            <div className={cn(CARD, "hidden overflow-hidden md:block")}>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1080px] border-collapse text-[13px]">
                  <thead>
                    <tr className="border-b border-[#eef2f7] bg-[#f8fafc] text-left text-[11px] font-bold uppercase tracking-[0.05em] text-[#94a3b8]">
                      <th className="px-4 py-2.5 font-bold">Punonjësi</th>
                      <th className="px-4 py-2.5 font-bold">Lloji</th>
                      <th className="px-4 py-2.5 font-bold">Datat</th>
                      <th className="px-4 py-2.5 font-bold">Statusi</th>
                      <th className="px-4 py-2.5 font-bold">Payroll final</th>
                      <th className="px-4 py-2.5 font-bold">Dokumenti</th>
                      <th className="px-4 py-2.5 font-bold">Checklist</th>
                      <th className="px-4 py-2.5 text-right font-bold">Veprime</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => {
                      const closed = r.status === "COMPLETED" || r.status === "CANCELLED";
                      const progress = props.checklistProgress?.[r.id] ?? { done: 0, total: 6 };
                      return (
                        <tr
                          key={r.id}
                          className={cn(
                            "border-b border-[#f1f5f9] transition-colors last:border-0 hover:bg-[#f8fafc]",
                            closed && "opacity-60",
                          )}
                        >
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              <InitialsAvatar firstName={r.employee.firstName} lastName={r.employee.lastName} />
                              <div className="min-w-0">
                                <Link
                                  href={`/punonjesit/${r.employee.id}`}
                                  className="block truncate font-semibold text-[#0f172a] transition-colors hover:text-brand-blue"
                                >
                                  {r.employee.firstName} {r.employee.lastName}
                                </Link>
                                <p className="truncate text-[12px] text-[#94a3b8]">
                                  {r.employee.personalId}
                                  {r.employee.jobTitle ? ` · ${r.employee.jobTitle}` : ""}
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-[#334155]">{TERMINATION_TYPE_LABELS[r.type]}</td>
                          <td className="px-4 py-3">
                            <p className="font-medium tabular-nums text-[#111827]">{fmtDate(r.terminationDate)}</p>
                            <p className="mt-0.5 text-[12px] tabular-nums text-[#94a3b8]">
                              Dita e fundit: {fmtDate(r.lastWorkingDay)}
                            </p>
                          </td>
                          <td className="px-4 py-3">
                            <StatusChip tone={TERMINATION_STATUS_TONES[r.status] ?? "neutral"}>
                              {TERMINATION_STATUS_LABELS[r.status] ?? r.status}
                            </StatusChip>
                          </td>
                          <td className="px-4 py-3">
                            <PayrollCell row={r} />
                          </td>
                          <td className="px-4 py-3">
                            {r.generatedDocument ? (
                              <Link
                                href={`/dokumentet/${r.generatedDocument.id}`}
                                className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-brand-blue hover:underline"
                              >
                                <FileText className="h-3.5 w-3.5" aria-hidden />
                                Hap
                              </Link>
                            ) : (
                              <span className="text-[12px] text-[#94a3b8]">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <ChecklistProgress done={progress.done} total={progress.total} />
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-end gap-1.5">
                              <RowNextAction row={r} pending={pending} startTransition={startTransition} />
                              <RowActionsMenu row={r} pending={pending} startTransition={startTransition} />
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Mobile cards */}
            <div className="grid gap-3 md:hidden">
              {rows.map((r) => {
                const closed = r.status === "COMPLETED" || r.status === "CANCELLED";
                const progress = props.checklistProgress?.[r.id] ?? { done: 0, total: 6 };
                return (
                  <div key={r.id} className={cn(CARD, "p-4", closed && "opacity-60")}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-3">
                        <InitialsAvatar firstName={r.employee.firstName} lastName={r.employee.lastName} />
                        <div>
                          <Link
                            href={`/punonjesit/${r.employee.id}`}
                            className="font-semibold text-[#0f172a] hover:text-brand-blue"
                          >
                            {r.employee.firstName} {r.employee.lastName}
                          </Link>
                          <p className="text-[12px] text-[#94a3b8]">
                            {r.employee.personalId}
                            {r.employee.jobTitle ? ` · ${r.employee.jobTitle}` : ""}
                          </p>
                        </div>
                      </div>
                      <StatusChip tone={TERMINATION_STATUS_TONES[r.status] ?? "neutral"}>
                        {TERMINATION_STATUS_LABELS[r.status] ?? r.status}
                      </StatusChip>
                    </div>
                    <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-[12.5px]">
                      <div>
                        <dt className="text-[11px] font-bold uppercase tracking-[0.05em] text-[#94a3b8]">Lloji</dt>
                        <dd className="mt-0.5 text-[#334155]">{TERMINATION_TYPE_LABELS[r.type]}</dd>
                      </div>
                      <div>
                        <dt className="text-[11px] font-bold uppercase tracking-[0.05em] text-[#94a3b8]">Datat</dt>
                        <dd className="mt-0.5 tabular-nums text-[#334155]">
                          {fmtDate(r.terminationDate)}
                          <span className="text-[#94a3b8]"> → {fmtDate(r.lastWorkingDay)}</span>
                        </dd>
                      </div>
                      <div>
                        <dt className="text-[11px] font-bold uppercase tracking-[0.05em] text-[#94a3b8]">Payroll</dt>
                        <dd className="mt-0.5">
                          <PayrollCell row={r} />
                        </dd>
                      </div>
                      <div>
                        <dt className="text-[11px] font-bold uppercase tracking-[0.05em] text-[#94a3b8]">Dokumenti</dt>
                        <dd className="mt-0.5">
                          {r.generatedDocument ? (
                            <Link
                              href={`/dokumentet/${r.generatedDocument.id}`}
                              className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-brand-blue hover:underline"
                            >
                              <FileText className="h-3.5 w-3.5" aria-hidden />
                              Hap
                            </Link>
                          ) : (
                            <span className="text-[12px] text-[#94a3b8]">—</span>
                          )}
                        </dd>
                      </div>
                    </dl>
                    <div className="mt-3">
                      <ChecklistProgress done={progress.done} total={progress.total} />
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-[#f1f5f9] pt-3">
                      <Link href={`/largimet/${r.id}`} className={BTN_DENSE_SECONDARY}>
                        Hap
                      </Link>
                      <RowNextAction row={r} pending={pending} startTransition={startTransition} />
                      <RowActionsMenu row={r} pending={pending} startTransition={startTransition} />
                    </div>
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

function StatCard(props: { label: string; value: number; icon: ReactNode; tile: string }) {
  return (
    <div className={cn(CARD, "flex items-center gap-3.5 p-4")}>
      <span className={cn("flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-[10px]", props.tile)}>
        {props.icon}
      </span>
      <div className="min-w-0">
        <p className="truncate text-[11px] font-bold uppercase tracking-[0.05em] text-[#94a3b8]">{props.label}</p>
        <p className="text-[24px] font-extrabold leading-tight tracking-[-0.02em] tabular-nums text-[#0f172a]">
          {props.value}
        </p>
      </div>
    </div>
  );
}

function LargimetFiltersClient(props: {
  filters: {
    status?: string;
    type?: string;
    employeeId?: string;
    year?: number;
    month?: number;
  };
  employees: EmployeePickerOption[];
}) {
  const currentYear = new Date().getUTCFullYear();
  const [employeeId, setEmployeeId] = useState(props.filters.employeeId ?? "");
  const [year, setYear] = useState(props.filters.year != null ? String(props.filters.year) : "");
  const [month, setMonth] = useState(props.filters.month != null ? String(props.filters.month) : "");

  const employeeForId = (id: string) => props.employees.find((employee) => employee.id === id);
  const yearsForEmployee = (id: string): number[] => {
    if (id) {
      const employee = employeeForId(id);
      return employee ? eligibleTerminationYears(new Date(employee.hireDate), currentYear) : [];
    }
    return [...new Set(
      props.employees.flatMap((employee) =>
        eligibleTerminationYears(new Date(employee.hireDate), currentYear),
      ),
    )].sort((a, b) => b - a);
  };
  const monthsForPeriod = (id: string, selectedYear: string): number[] => {
    const numericYear = Number(selectedYear);
    if (!Number.isInteger(numericYear)) return [];
    if (id) {
      const employee = employeeForId(id);
      return employee ? eligibleTerminationMonths(new Date(employee.hireDate), numericYear) : [];
    }
    return [...new Set(
      props.employees.flatMap((employee) =>
        eligibleTerminationMonths(new Date(employee.hireDate), numericYear),
      ),
    )].sort((a, b) => a - b);
  };

  const eligibleYears = yearsForEmployee(employeeId);
  const eligibleMonths = monthsForPeriod(employeeId, year);

  function changeEmployee(nextEmployeeId: string) {
    const nextYears = yearsForEmployee(nextEmployeeId);
    const nextYear = nextYears.includes(Number(year)) ? year : String(nextYears[0] ?? "");
    const nextMonths = monthsForPeriod(nextEmployeeId, nextYear);
    setEmployeeId(nextEmployeeId);
    setYear(nextYear);
    if (month && !nextMonths.includes(Number(month))) setMonth("");
  }

  function changeYear(nextYear: string) {
    const nextMonths = monthsForPeriod(employeeId, nextYear);
    setYear(nextYear);
    if (month && !nextMonths.includes(Number(month))) setMonth("");
  }

  return (
    <form
      className={cn(CARD, "flex flex-col gap-3 p-4 md:flex-row md:flex-wrap md:items-end")}
      action="/largimet"
      method="get"
    >
      <div className="grid gap-1.5">
        <label className={FIELD_LABEL} htmlFor="largimet-filter-status">
          Statusi
        </label>
        <select
          id="largimet-filter-status"
          name="status"
          defaultValue={props.filters.status ?? "ALL"}
          className={FIELD_SELECT}
        >
          <option value="ALL">Të gjitha</option>
          <option value="DRAFT">Draft</option>
          <option value="PENDING_REVIEW">Në shqyrtim</option>
          <option value="APPROVED">I miratuar</option>
          <option value="COMPLETED">I përfunduar</option>
          <option value="CANCELLED">I anuluar</option>
        </select>
      </div>
      <div className="grid gap-1.5">
        <label className={FIELD_LABEL} htmlFor="largimet-filter-type">
          Lloji
        </label>
        <select id="largimet-filter-type" name="type" defaultValue={props.filters.type ?? "ALL"} className={FIELD_SELECT}>
          <option value="ALL">Të gjitha</option>
          {(Object.keys(TERMINATION_TYPE_LABELS) as TerminationType[]).map((k) => (
            <option key={k} value={k}>
              {TERMINATION_TYPE_LABELS[k]}
            </option>
          ))}
        </select>
      </div>
      <div className="grid gap-1.5">
        <label className={FIELD_LABEL} htmlFor="largimet-filter-employee">
          Punonjësi
        </label>
        <select
          id="largimet-filter-employee"
          name="employeeId"
          value={employeeId}
          onChange={(event) => changeEmployee(event.target.value)}
          className={cn(FIELD_SELECT, "max-w-[220px]")}
        >
          <option value="">Të gjithë</option>
          {props.employees.map((e) => (
            <option key={e.id} value={e.id}>
              {e.lastName}, {e.firstName}
            </option>
          ))}
        </select>
      </div>
      <div className="grid gap-1.5">
        <label className={FIELD_LABEL} htmlFor="largimet-filter-year">
          Viti
        </label>
        <select
          id="largimet-filter-year"
          name="year"
          value={year}
          onChange={(event) => changeYear(event.target.value)}
          className={cn(FIELD_SELECT, "w-32")}
        >
          <option value="">Të gjitha vitet</option>
          {eligibleYears.map((eligibleYear) => (
            <option key={eligibleYear} value={String(eligibleYear)}>
              {eligibleYear}
            </option>
          ))}
        </select>
      </div>
      <div className="grid gap-1.5">
        <label className={FIELD_LABEL} htmlFor="largimet-filter-month">
          Muaji
        </label>
        <select
          id="largimet-filter-month"
          name="month"
          value={month}
          onChange={(event) => setMonth(event.target.value)}
          disabled={!year}
          className={cn(FIELD_SELECT, "w-36 disabled:cursor-not-allowed disabled:bg-[#f8fafc] disabled:text-[#94a3b8]")}
        >
          <option value="">{year ? "Të gjithë muajt" : "Zgjidhni vitin"}</option>
          {eligibleMonths.map((eligibleMonth) => (
            <option key={eligibleMonth} value={String(eligibleMonth)}>
              {payrollMonthNameSq(eligibleMonth)}
            </option>
          ))}
        </select>
      </div>
      <button type="submit" className={cn(BTN_SECONDARY, "h-9 px-4 text-[13px]")}>
        Filtroni
      </button>
    </form>
  );
}

function PayrollCell({ row }: { row: LargimetRowSerialized }) {
  if (row.finalPayroll) {
    const meta = PAYROLL_STATUS_META[row.finalPayroll.status] ?? {
      label: row.finalPayroll.status,
      tone: "neutral" as ChipTone,
    };
    return (
      <div className="flex flex-wrap items-center gap-1.5">
        <Link
          href={`/pagat/${row.finalPayroll.id}`}
          className="text-[12.5px] font-semibold tabular-nums text-brand-blue hover:underline"
        >
          {row.finalPayroll.month}/{row.finalPayroll.year}
        </Link>
        <StatusChip tone={meta.tone}>{meta.label}</StatusChip>
      </div>
    );
  }
  if (row.finalPayrollRequired) {
    return <StatusChip tone="warning">Kërkohet</StatusChip>;
  }
  return <span className="text-[12px] text-[#94a3b8]">—</span>;
}

function useRowRunner(startTransition: (fn: () => void) => void) {
  return function run(fn: () => Promise<{ ok: boolean; error?: string }>) {
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) toast.error(res.error ?? "Gabim.");
      else toast.success("U krye.");
    });
  };
}

/** Per-status next action (the register's inline CTA). */
function RowNextAction(props: {
  row: LargimetRowSerialized;
  pending: boolean;
  startTransition: (fn: () => void) => void;
}) {
  const { row, pending, startTransition } = props;
  const run = useRowRunner(startTransition);

  if (row.status === "DRAFT") {
    return (
      <button
        type="button"
        className={BTN_DENSE_PRIMARY}
        disabled={pending}
        onClick={() => run(() => submitTerminationAction({ id: row.id }))}
      >
        Dërgo
      </button>
    );
  }
  if (row.status === "PENDING_REVIEW") {
    return (
      <button
        type="button"
        className={BTN_DENSE_PRIMARY}
        disabled={pending}
        onClick={() => run(() => approveTerminationAction({ id: row.id }))}
      >
        Mirato
      </button>
    );
  }
  if (row.status === "APPROVED") {
    return (
      <button
        type="button"
        className={BTN_DENSE_PRIMARY}
        disabled={pending}
        onClick={() => run(() => completeTerminationAction({ id: row.id }))}
      >
        Përfundo
      </button>
    );
  }
  return (
    <Link href={`/largimet/${row.id}`} className={BTN_DENSE_SECONDARY}>
      Shiko
    </Link>
  );
}

/** The rest of the quick actions, folded into a per-row menu. */
function RowActionsMenu(props: {
  row: LargimetRowSerialized;
  pending: boolean;
  startTransition: (fn: () => void) => void;
}) {
  const { row, pending, startTransition } = props;
  const run = useRowRunner(startTransition);
  const closed = row.status === "COMPLETED" || row.status === "CANCELLED";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="inline-flex h-8 w-8 items-center justify-center rounded-[8px] text-[#94a3b8] transition-colors hover:bg-[#eef2f7] hover:text-[#475569] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue/40"
          aria-label="Veprime"
        >
          <MoreHorizontal className="h-4 w-4" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuItem asChild>
          <Link href={`/largimet/${row.id}`}>Shiko detajet</Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          disabled={pending || closed}
          onClick={() => run(() => generateTerminationDocumentActionServer({ id: row.id }))}
        >
          Gjenero dokumentin
        </DropdownMenuItem>
        <DropdownMenuItem
          disabled={pending || closed}
          onClick={() => run(() => prepareFinalPayrollTerminationAction({ id: row.id }))}
        >
          Përgatit payroll
        </DropdownMenuItem>
        {!closed ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              disabled={pending}
              onClick={() => run(() => cancelTerminationAction({ id: row.id }))}
            >
              Anulo largimin
            </DropdownMenuItem>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function CreateTerminationDialogContent(props: {
  employees: EmployeePickerOption[];
  pending: boolean;
  startTransition: (fn: () => void) => void;
  onDone: () => void;
}) {
  const [employeeId, setEmployeeId] = useState("");
  const [type, setType] = useState<TerminationType>("LARGIM_VULLNETAR");
  const [terminationDate, setTerminationDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [lastWorkingDay, setLastWorkingDay] = useState(() => new Date().toISOString().slice(0, 10));
  const [reason, setReason] = useState("");
  const [details, setDetails] = useState("");
  const [finalPayrollRequired, setFinalPayrollRequired] = useState(true);

  function submit() {
    props.startTransition(async () => {
      const res = await createTerminationAction({
        employeeId,
        type,
        terminationDate: new Date(`${terminationDate}T12:00:00.000Z`).toISOString(),
        lastWorkingDay: new Date(`${lastWorkingDay}T12:00:00.000Z`).toISOString(),
        reason: reason.trim() || undefined,
        details: details.trim() || undefined,
        finalPayrollRequired,
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Largimi u krijua.");
      props.onDone();
      const newId = res.data?.id;
      if (newId) {
        window.location.href = `/largimet/${newId}`;
      }
    });
  }

  return (
    <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
      <DialogHeader>
        <DialogTitle>Krijo largim</DialogTitle>
        <DialogDescription>Përzgjidh punonjësin dhe llojin e procesit.</DialogDescription>
      </DialogHeader>
      <div className="grid gap-3 py-2">
        <div className="space-y-1.5">
          <label className={FIELD_LABEL}>Punonjësi</label>
          <select
            className={cn(FIELD_SELECT, "h-10 w-full")}
            value={employeeId}
            onChange={(e) => setEmployeeId(e.target.value)}
            disabled={props.pending}
          >
            <option value="">Zgjidhni…</option>
            {props.employees.map((e) => (
              <option key={e.id} value={e.id}>
                {e.lastName}, {e.firstName} ({e.personalId})
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <label className={FIELD_LABEL}>Lloji</label>
          <select
            className={cn(FIELD_SELECT, "h-10 w-full")}
            value={type}
            onChange={(e) => setType(e.target.value as TerminationType)}
            disabled={props.pending}
          >
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
              className={cn(FIELD_INPUT, "w-full")}
              value={terminationDate}
              onChange={(e) => setTerminationDate(e.target.value)}
              disabled={props.pending}
            />
          </div>
          <div className="space-y-1.5">
            <label className={FIELD_LABEL}>Dita e fundit e punës</label>
            <input
              type="date"
              className={cn(FIELD_INPUT, "w-full")}
              value={lastWorkingDay}
              onChange={(e) => setLastWorkingDay(e.target.value)}
              disabled={props.pending}
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <label className={FIELD_LABEL}>Arsyeja</label>
          <textarea
            className="min-h-[72px] w-full rounded-[8px] border border-[#e2e8f0] bg-white px-3 py-2 text-[13px] text-[#334155] outline-none transition-colors focus:border-brand-blue"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            disabled={props.pending}
          />
        </div>
        <div className="space-y-1.5">
          <label className={FIELD_LABEL}>Detaje</label>
          <textarea
            className="min-h-[72px] w-full rounded-[8px] border border-[#e2e8f0] bg-white px-3 py-2 text-[13px] text-[#334155] outline-none transition-colors focus:border-brand-blue"
            value={details}
            onChange={(e) => setDetails(e.target.value)}
            disabled={props.pending}
          />
        </div>
        <label className="flex items-center gap-2 text-[13px] text-[#334155]">
          <input
            type="checkbox"
            className="h-4 w-4 accent-[#2563EB]"
            checked={finalPayrollRequired}
            onChange={(e) => setFinalPayrollRequired(e.target.checked)}
            disabled={props.pending}
          />
          Final payroll i detyrueshëm
        </label>
      </div>
      <DialogFooter>
        <button type="button" className={BTN_PRIMARY} onClick={submit} disabled={props.pending || !employeeId}>
          Ruaj
        </button>
      </DialogFooter>
    </DialogContent>
  );
}
