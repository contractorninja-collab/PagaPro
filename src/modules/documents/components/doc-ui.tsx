import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * 1b design-language primitives, local to the Dokumentet module.
 * Tokens per design_handoff_pagapro_1b/README.md — cards, chips, buttons, table cells.
 */

export const docCard =
  "rounded-xl border border-[#e2e8f0] bg-white shadow-[0_1px_3px_rgba(15,23,42,0.05)]";

export const docHeroCard =
  "rounded-[14px] border border-[#e2e8f0] bg-white shadow-[0_1px_3px_rgba(15,23,42,0.05)]";

export const docBtnPrimary =
  "inline-flex h-10 items-center justify-center gap-2 whitespace-nowrap rounded-[10px] bg-brand-blue px-[18px] text-[13.5px] font-semibold text-white transition-colors hover:bg-[#1d4ed8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50";

export const docBtnPrimaryDense =
  "inline-flex h-[38px] items-center justify-center gap-2 whitespace-nowrap rounded-[10px] bg-brand-blue px-4 text-[13px] font-semibold text-white transition-colors hover:bg-[#1d4ed8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50";

export const docBtnSecondary =
  "inline-flex h-10 items-center justify-center gap-2 whitespace-nowrap rounded-[10px] border border-[#e2e8f0] bg-white px-[18px] text-[13.5px] font-semibold text-[#334155] transition-colors hover:bg-[#eef2f7] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50";

export const docBtnSecondaryDense =
  "inline-flex h-[34px] items-center justify-center gap-1.5 whitespace-nowrap rounded-[9px] border border-[#e2e8f0] bg-white px-3 text-[12.5px] font-semibold text-[#334155] transition-colors hover:bg-[#eef2f7] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50";

export const docSelect =
  "h-9 rounded-lg border border-[#e2e8f0] bg-white px-3 text-[13px] font-medium text-[#334155] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export const docInput =
  "h-9 w-full rounded-lg border border-[#e2e8f0] bg-white px-3 text-[13px] text-[#111827] placeholder:text-[#94a3b8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export const docTableHead =
  "px-4 py-2.5 text-left text-[11px] font-bold uppercase tracking-[0.06em] text-[#94a3b8]";

export const docTableCell = "px-4 py-3 align-top";

export type DocChipTone =
  | "success"
  | "warning"
  | "destructive"
  | "info"
  | "neutral"
  | "locked";

const CHIP_TONES: Record<DocChipTone, { chip: string; dot: string }> = {
  success: { chip: "bg-[#ecfdf5] text-[#15803d]", dot: "bg-[#16a34a]" },
  warning: { chip: "bg-[#fffbeb] text-[#b45309]", dot: "bg-[#d97706]" },
  destructive: { chip: "bg-[#fef2f2] text-[#dc2626]", dot: "bg-[#dc2626]" },
  info: { chip: "bg-[#eff6ff] text-brand-blue", dot: "bg-brand-blue" },
  neutral: { chip: "bg-[#f1f5f9] text-[#64748b]", dot: "bg-[#94a3b8]" },
  locked: { chip: "bg-brand-navy text-white", dot: "bg-white" },
};

/** Full-radius semantic status chip (README "Semantic colors"). */
export function DocChip({
  tone = "neutral",
  children,
  withDot = true,
  className,
}: {
  tone?: DocChipTone;
  children: ReactNode;
  withDot?: boolean;
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
      {withDot ? <span className={cn("h-1.5 w-1.5 rounded-full", t.dot)} aria-hidden /> : null}
      {children}
    </span>
  );
}
