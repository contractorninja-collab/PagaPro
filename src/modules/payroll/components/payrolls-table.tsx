"use client";

import Link from "next/link";
import type { PayrollPeriodStatus } from "@prisma/client";
import { Button } from "@/components/ui/button";
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

function isComplete(status: PayrollPeriodStatus): boolean {
  return status === "ARCHIVED";
}

function needsAction(status: PayrollPeriodStatus): boolean {
  return status === "DRAFT" || status === "REVIEWED" || status === "APPROVED";
}

function ProgressRail({ status }: { status: PayrollPeriodStatus }) {
  const currentIndex = STATUS_ORDER[status];

  return (
    <div className="flex items-center gap-0" role="list" aria-label="Hapat e payroll">
      {PAYROLL_STEPS.map((step, i) => {
        const isDone = i < currentIndex;
        const isActive = i === currentIndex;
        const isIdle = i > currentIndex;

        return (
          <div key={step.key} className="flex flex-1 items-center" role="listitem">
            <div className="flex flex-col items-center gap-1">
              <div
                className={cn(
                  "flex h-5 w-5 items-center justify-center rounded-full border text-[9px] font-medium",
                  isDone && "border-emerald-300 bg-emerald-50 text-emerald-800",
                  isActive && "border-blue-300 bg-blue-50 text-blue-800 ring-2 ring-blue-100",
                  isIdle && "border-border bg-muted text-muted-foreground",
                )}
                aria-current={isActive ? "step" : undefined}
              >
                {isDone ? (
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden>
                    <path d="M2 5l2.5 2.5L8 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                ) : (
                  <span>{i + 1}</span>
                )}
              </div>
              <span
                className={cn(
                  "text-[9px] leading-tight text-center w-12",
                  isActive && "font-medium text-blue-700",
                  isDone && "text-emerald-700",
                  isIdle && "text-muted-foreground",
                )}
              >
                {step.label}
              </span>
            </div>
            {i < PAYROLL_STEPS.length - 1 && (
              <div
                className={cn(
                  "mb-3.5 h-px flex-1",
                  i < currentIndex ? "bg-emerald-200" : "bg-border",
                )}
                aria-hidden
              />
            )}
          </div>
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

function PayrollCard({
  row,
  onRegenerate,
  onReview,
  onApprove,
  onLock,
  onArchive,
  onPdf,
}: {
  row: PayrollListRow;
  onRegenerate: (id: string) => void;
  onReview: (id: string) => void;
  onApprove: (id: string) => void;
  onLock: (id: string) => void;
  onArchive: (id: string) => void;
  onPdf: (id: string) => void;
}) {
  const primary = getPrimaryAction(row.status, { onReview, onApprove, onLock, onArchive });
  const complete = isComplete(row.status);
  const active = needsAction(row.status);

  return (
    <div
      className={cn(
        "rounded-lg border bg-card transition-shadow",
        active && "border-blue-200 shadow-sm",
        complete && "border-border opacity-60",
        !active && !complete && "border-border",
      )}
    >
      {/* Card header */}
      <div className="flex items-start justify-between gap-3 p-4 pb-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Link
              href={`/pagat/${row.id}`}
              className="text-sm font-semibold text-foreground hover:underline"
            >
              {row.monthLabel}
            </Link>
            <PayrollStatusBadge status={row.status} />
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {row.employeeCount} punonjës · €{row.totalGross} bruto · €{row.totalNet} neto
          </p>
        </div>

        {/* Primary CTA — only for actionable statuses */}
        {primary && (
          <Button
            type="button"
            size="sm"
            className="shrink-0 text-xs"
            onClick={() => primary.handler(row.id)}
          >
            {primary.label}
          </Button>
        )}
      </div>

      {/* Progress rail */}
      <div className="border-t border-border/60 px-4 py-3">
        <ProgressRail status={row.status} />
      </div>

      {/* Secondary actions footer */}
      <div className="flex flex-wrap items-center gap-2 border-t border-border/60 px-4 py-2.5">
        <Button asChild variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground">
          <Link href={`/pagat/${row.id}`}>Hap detajet</Link>
        </Button>

        {row.status === "DRAFT" && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs text-muted-foreground"
            type="button"
            onClick={() => onRegenerate(row.id)}
          >
            Ripëllogarit
          </Button>
        )}

        {(row.status === "APPROVED" || row.status === "LOCKED") && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs text-muted-foreground"
            type="button"
            onClick={() => onPdf(row.id)}
          >
            Gjenero PDF
          </Button>
        )}

        <span className="ml-auto text-[10px] text-muted-foreground">
          {formatIsoDateUtcDdMmYyyy(row.createdAt)}
        </span>
      </div>
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
  const { rows, onRegenerate, onReview, onApprove, onLock, onArchive, onPdf } = props;

  if (rows.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-card py-12 text-center text-sm text-muted-foreground">
        Nuk ka periudha pagë. Krijoni një payroll për të filluar.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {rows.map((row) => (
        <PayrollCard
          key={row.id}
          row={row}
          onRegenerate={onRegenerate}
          onReview={onReview}
          onApprove={onApprove}
          onLock={onLock}
          onArchive={onArchive}
          onPdf={onPdf}
        />
      ))}
    </div>
  );
}
