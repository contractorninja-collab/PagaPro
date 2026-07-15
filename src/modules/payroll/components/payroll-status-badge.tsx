import type { PayrollPeriodStatus } from "@prisma/client";
import { Lock } from "lucide-react";
import { cn } from "@/lib/utils";

const LABELS: Record<PayrollPeriodStatus, string> = {
  DRAFT: "Draft",
  REVIEWED: "Në shqyrtim",
  APPROVED: "I miratuar",
  LOCKED: "I kyçur",
  ARCHIVED: "I arkivuar",
};

/** 1b semantic pill tones — warning / info / success / locked (solid navy) / neutral. */
const TONES: Record<PayrollPeriodStatus, { chip: string; dot: string }> = {
  DRAFT: { chip: "bg-[#fffbeb] text-[#b45309]", dot: "bg-[#d97706]" },
  REVIEWED: { chip: "bg-[#eff6ff] text-brand-blue", dot: "bg-brand-blue" },
  APPROVED: { chip: "bg-[#ecfdf5] text-[#15803d]", dot: "bg-[#16a34a]" },
  LOCKED: { chip: "bg-brand-navy text-white", dot: "" },
  ARCHIVED: { chip: "bg-[#f1f5f9] text-[#64748b]", dot: "bg-[#94a3b8]" },
};

export function PayrollStatusBadge({ status }: { status: PayrollPeriodStatus }) {
  const tone = TONES[status];
  return (
    <span
      className={cn(
        "inline-flex h-[22px] items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 text-[11.5px] font-semibold",
        tone.chip,
      )}
    >
      {status === "LOCKED" ? (
        <Lock className="h-[11px] w-[11px]" strokeWidth={2.5} aria-hidden />
      ) : (
        <span className={cn("h-1.5 w-1.5 rounded-full", tone.dot)} aria-hidden />
      )}
      {LABELS[status]}
    </span>
  );
}
