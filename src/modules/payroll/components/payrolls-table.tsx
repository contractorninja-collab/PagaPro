"use client";

import { Fragment } from "react";
import Link from "next/link";
import type { PayrollPeriodStatus } from "@prisma/client";
import { ArrowRight, Check } from "lucide-react";
import { PayrollStatusBadge } from "@/modules/payroll/components/payroll-status-badge";
import { formatIsoDateUtcDdMmYyyy } from "@/modules/payroll/helpers/display-date";
import { cn } from "@/lib/utils";

type PayrollStep = {
  key: PayrollPeriodStatus | "DONE";
  label: string;
};

const PAYROLL_STEPS: PayrollStep[] = [
  { key: "DRAFT", label: "Draft" },
  { key: "REVIEWED", label: "Shqyrtim" },
  { key: "APPROVED", label: "Miratim" },
  { key: "LOCKED", label: "Kyçur" },
  { key: "ARCHIVED", label: "Arkivuar" },
];

const STATUS_ORDER: Record<PayrollPeriodStatus, number> = {
  DRAFT: 0,
  REVIEWED: 1,
  APPROVED: 2,
  LOCKED: 3,
  ARCHIVED: 4,
};

const BTN_PRIMARY =
  "inline-flex h-[38px] items-center gap-1.5 whitespace-nowrap rounded-[9px] bg-brand-blue px-[18px] text-[13px] font-semibold text-white transition-colors hover:bg-[#1d4ed8]";
const BTN_SECONDARY =
  "inline-flex h-[38px] items-center gap-1.5 whitespace-nowrap rounded-[9px] border border-[#e2e8f0] bg-white px-[15px] text-[13px] font-semibold text-[#334155] transition-colors hover:bg-[#eef2f7]";

type PrimaryAction = {
  label: string;
  handler: (id: string) => void;
} | null;

function getPrimaryAction(
  status: PayrollPeriodStatus,
  handlers: {
    onReview: (id: string) => void;
    onApprove: (id: string) => void;
    onLock: (id: string) => void;
    onArchive: (id: string) => void;
  },
): PrimaryAction {
  switch (status) {
    case "DRAFT":
      return { label: "Shëno të shqyrtuar →", handler: handlers.onReview };
    case "REVIEWED":
      return { label: "Mirato →", handler: handlers.onApprove };
    case "APPROVED":
      return { label: "Kyç payroll →", handler: handlers.onLock };
    case "LOCKED":
      return { label: "Arkivo", handler: handlers.onArchive };
    default:
      return null;
  }
}

/** Plain payroll decimal string → EUR display (e.g. €91,640.00). */
function formatListEuro(raw: string): string {
  const n = Number(String(raw).trim().replace(",", "."));
  if (!Number.isFinite(n)) return `€${raw}`;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

/** 5-node stage rail Draft→Shqyrtim→Miratim→Kyçur→Arkivuar with done/active/idle states. */
function StageRail({ status }: { status: PayrollPeriodStatus }) {
  const currentIndex = STATUS_ORDER[status];

  return (
    <div className="flex items-start px-5 pb-[18px] pt-1.5 sm:px-6" role="list" aria-label="Hapat e payroll">
      {PAYROLL_STEPS.map((step, i) => {
        const isDone = i < currentIndex;
        const isActive = i === currentIndex;

        return (
          <Fragment key={step.key}>
            {i > 0 ? (
              <div
                className={cn("mt-[11px] h-[2px] flex-1", i <= currentIndex ? "bg-[#86efac]" : "bg-[#e2e8f0]")}
                aria-hidden
              />
            ) : null}
            <div
              className="flex w-14 flex-col items-center gap-1.5 sm:w-20"
              role="listitem"
              aria-current={isActive ? "step" : undefined}
            >
              <div
                className={cn(
                  "flex h-[22px] w-[22px] items-center justify-center rounded-full border text-[11px] font-semibold",
                  isDone && "border-[#86efac] bg-[#ecfdf5] text-[#15803d]",
                  isActive && "border-[#93c5fd] bg-[#eff6ff] font-bold text-[#1d4ed8] shadow-[0_0_0_3px_#dbeafe]",
                  !isDone && !isActive && "border-[#e2e8f0] bg-[#f1f5f9] text-[#94a3b8]",
                )}
              >
                {isDone ? <Check className="h-3 w-3" strokeWidth={3} aria-hidden /> : <span>{i + 1}</span>}
              </div>
              <span
                className={cn(
                  "text-center text-[10.5px] leading-tight",
                  isDone && "font-semibold text-[#15803d]",
                  isActive && "font-bold text-[#1d4ed8]",
                  !isDone && !isActive && "font-medium text-[#94a3b8]",
                )}
              >
                {step.label}
              </span>
            </div>
          </Fragment>
        );
      })}
    </div>
  );
}

export type PayrollListRow = {
  id: string;
  year: number;
  month: number;
  monthLabel: string;
  companyLabel: string;
  employeeCount: number;
  totalGross: string;
  totalNet: string;
  status: PayrollPeriodStatus;
  createdAt: string;
};

type RowHandlers = {
  onRegenerate: (id: string) => void;
  onReview: (id: string) => void;
  onApprove: (id: string) => void;
  onLock: (id: string) => void;
  onArchive: (id: string) => void;
  onPdf: (id: string) => void;
};

function HeroStat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="text-right">
      <div className="mb-[3px] text-[11.5px] text-[#94a3b8]">{label}</div>
      <div
        className={cn(
          "text-[19px] font-bold leading-tight text-[#0f172a] [font-variant-numeric:tabular-nums]",
          accent && "font-extrabold text-[#1d4ed8]",
        )}
      >
        {value}
      </div>
    </div>
  );
}

/** 3a — active-run hero card: period, status pill, figures, stage rail, action bar. */
function ActiveRunHero({ row, handlers }: { row: PayrollListRow; handlers: RowHandlers }) {
  const primary = getPrimaryAction(row.status, handlers);

  return (
    <section className="overflow-hidden rounded-[14px] border border-[#dbe4f0] bg-white shadow-[0_1px_3px_rgba(15,23,42,0.05)]">
      <div className="flex flex-col gap-4 px-5 pb-4 pt-5 sm:flex-row sm:items-start sm:justify-between sm:gap-5 sm:px-6">
        <div className="min-w-0">
          <div className="mb-2 flex flex-wrap items-center gap-x-[11px] gap-y-1.5">
            <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-brand-blue">
              Periudha aktive
            </span>
            <PayrollStatusBadge status={row.status} />
          </div>
          <h2 className="m-0 text-[22px] font-bold leading-tight tracking-[-0.02em] text-[#0f172a]">
            <Link href={`/pagat/${row.id}`} className="hover:underline">
              {row.monthLabel}
            </Link>
          </h2>
        </div>
        <div className="flex shrink-0 flex-wrap items-start gap-x-9 gap-y-3">
          <HeroStat label="Punonjës" value={String(row.employeeCount)} />
          <HeroStat label="Bruto" value={formatListEuro(row.totalGross)} />
          <HeroStat label="Neto" value={formatListEuro(row.totalNet)} accent />
        </div>
      </div>

      <StageRail status={row.status} />

      <div className="flex flex-wrap items-center gap-2.5 border-t border-[#eef2f7] bg-[#fbfcfe] px-5 py-3.5 sm:px-6">
        <Link href={`/pagat/${row.id}`} className={BTN_PRIMARY}>
          Vazhdo shqyrtimin
          <ArrowRight className="h-[15px] w-[15px]" aria-hidden />
        </Link>
        {primary ? (
          <button type="button" className={BTN_SECONDARY} onClick={() => primary.handler(row.id)}>
            {primary.label}
          </button>
        ) : null}
        {row.status === "DRAFT" ? (
          <button type="button" className={BTN_SECONDARY} onClick={() => handlers.onRegenerate(row.id)}>
            Ripëllogarit
          </button>
        ) : null}
        {row.status === "APPROVED" || row.status === "LOCKED" ? (
          <button type="button" className={BTN_SECONDARY} onClick={() => handlers.onPdf(row.id)}>
            Gjenero PDF
          </button>
        ) : null}
        <span className="ml-auto text-[12.5px] text-[#94a3b8] [font-variant-numeric:tabular-nums]">
          Krijuar {formatIsoDateUtcDdMmYyyy(row.createdAt)}
        </span>
      </div>
    </section>
  );
}

const REGISTER_GRID = "grid grid-cols-[1.6fr_1.2fr_1fr_1.3fr_1.3fr_1.1fr_1.6fr] items-center gap-x-3";

function RegisterRow({ row, handlers }: { row: PayrollListRow; handlers: RowHandlers }) {
  const primary = getPrimaryAction(row.status, handlers);

  return (
    <div
      className={cn(
        REGISTER_GRID,
        "border-b border-[#f1f5f9] px-5 py-3.5 transition-colors last:border-b-0 hover:bg-[#f8fafc]",
      )}
    >
      <Link
        href={`/pagat/${row.id}`}
        className="truncate text-[13.5px] font-semibold text-[#0f172a] hover:underline"
      >
        {row.monthLabel}
      </Link>
      <span>
        <PayrollStatusBadge status={row.status} />
      </span>
      <span className="text-right text-[13px] text-[#334155] [font-variant-numeric:tabular-nums]">
        {row.employeeCount}
      </span>
      <span className="whitespace-nowrap text-right text-[13px] font-semibold text-[#0f172a] [font-variant-numeric:tabular-nums]">
        {formatListEuro(row.totalGross)}
      </span>
      <span className="whitespace-nowrap text-right text-[13px] text-[#334155] [font-variant-numeric:tabular-nums]">
        {formatListEuro(row.totalNet)}
      </span>
      <span className="whitespace-nowrap text-[12.5px] text-[#94a3b8] [font-variant-numeric:tabular-nums]">
        {formatIsoDateUtcDdMmYyyy(row.createdAt)}
      </span>
      <span className="flex flex-wrap items-center justify-end gap-x-3 gap-y-1 text-right">
        {primary ? (
          <button
            type="button"
            className="whitespace-nowrap text-[12.5px] font-semibold text-brand-blue hover:underline"
            onClick={() => primary.handler(row.id)}
          >
            {primary.label}
          </button>
        ) : null}
        {row.status === "DRAFT" ? (
          <button
            type="button"
            className="whitespace-nowrap text-[12.5px] font-semibold text-[#64748b] hover:text-[#334155] hover:underline"
            onClick={() => handlers.onRegenerate(row.id)}
          >
            Ripëllogarit
          </button>
        ) : null}
        {row.status === "APPROVED" || row.status === "LOCKED" ? (
          <button
            type="button"
            className="whitespace-nowrap text-[12.5px] font-semibold text-brand-blue hover:underline"
            onClick={() => handlers.onPdf(row.id)}
          >
            Gjenero PDF
          </button>
        ) : null}
        <Link
          href={`/pagat/${row.id}`}
          className="whitespace-nowrap text-[12.5px] font-semibold text-[#64748b] hover:text-[#334155] hover:underline"
        >
          Hap detajet
        </Link>
      </span>
    </div>
  );
}

export function PayrollsTable(props: {
  rows: PayrollListRow[];
  onRegenerate: (id: string) => void;
  onReview: (id: string) => void;
  onApprove: (id: string) => void;
  onLock: (id: string) => void;
  onArchive: (id: string) => void;
  onPdf: (id: string) => void;
}) {
  const { rows, ...handlers } = props;

  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-[#cbd5e1] bg-white py-12 text-center text-sm text-[#64748b]">
        Nuk ka periudha pagë. Krijoni një payroll për të filluar.
      </div>
    );
  }

  // Rows arrive ordered year desc / month desc — the first non-archived one is the active run.
  const hero = rows.find((r) => r.status !== "ARCHIVED") ?? null;
  const rest = hero ? rows.filter((r) => r.id !== hero.id) : rows;

  return (
    <div className="space-y-[22px]">
      {hero ? <ActiveRunHero row={hero} handlers={handlers} /> : null}

      {rest.length > 0 ? (
        <section>
          <h2 className="mb-3 text-[13px] font-bold text-[#0f172a]">
            {hero ? "Periudhat e mëparshme" : "Periudhat"}
          </h2>
          <div className="overflow-hidden rounded-xl border border-[#e2e8f0] bg-white shadow-[0_1px_3px_rgba(15,23,42,0.05)]">
            <div className="overflow-x-auto">
              <div className="min-w-[880px]">
                <div
                  className={cn(
                    REGISTER_GRID,
                    "border-b border-[#eef2f7] bg-[#f8fafc] px-5 py-3 text-[11px] font-bold uppercase tracking-[0.04em] text-[#94a3b8]",
                  )}
                >
                  <span>Periudha</span>
                  <span>Statusi</span>
                  <span className="text-right">Punonjës</span>
                  <span className="text-right">Bruto</span>
                  <span className="text-right">Neto</span>
                  <span>Krijuar</span>
                  <span className="text-right">Veprime</span>
                </div>
                {rest.map((row) => (
                  <RegisterRow key={row.id} row={row} handlers={handlers} />
                ))}
              </div>
            </div>
          </div>
        </section>
      ) : null}
    </div>
  );
}
