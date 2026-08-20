import type { ReactNode } from "react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { StatusPill } from "@/components/patterns/status-pill";

/**
 * 1b design-language primitives, local to the Dokumentet module.
 * Tokens per design_handoff_pagapro_1b/README.md — cards, chips, buttons, table cells.
 */

export { CARD as docCard } from "@/components/patterns/surface";

export const docHeroCard =
  "rounded-xl border border-line bg-white shadow-card";

export const docBtnPrimary = buttonVariants({ size: "lg" });

export const docBtnPrimaryDense = buttonVariants({ size: "default" });

export const docBtnSecondary = buttonVariants({ variant: "secondary", size: "lg" });

export const docBtnSecondaryDense = buttonVariants({ variant: "secondary", size: "default" });

export const docSelect =
  "h-9 rounded-lg border border-[#e2e8f0] bg-white px-3 text-[13px] font-medium text-[#334155] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export const docInput =
  "h-9 w-full rounded-lg border border-[#e2e8f0] bg-white px-3 text-[13px] text-[#111827] placeholder:text-[#94a3b8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export const docTableHead =
  "px-4 py-2.5 text-left text-[11px] font-bold uppercase tracking-[0.04em] text-[#94a3b8]";

export const docTableCell = "px-4 py-3 align-top";

export type DocChipTone =
  | "success"
  | "warning"
  | "destructive"
  | "info"
  | "neutral"
  | "locked";

/** Full-radius semantic status chip — delegates to THE StatusPill. */
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
  return (
    <StatusPill tone={tone} withDot={withDot} className={className}>
      {children}
    </StatusPill>
  );
}
