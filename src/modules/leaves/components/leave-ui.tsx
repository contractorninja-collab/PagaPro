import type { ReactNode } from "react";
import { buttonVariants } from "@/components/ui/button";
import type { LeaveType } from "@prisma/client";
import { StatusPill } from "@/components/patterns/status-pill";

/**
 * Shared presentational tokens for the Pushimet module (design handoff "1b", screens 5a/5b).
 * Presentation only — no data logic lives here.
 */

/** Standard 1b card shell: white, 1px #e2e8f0 border, radius 12px, flat shadow. */
export { CARD as LEAVE_CARD } from "@/components/patterns/surface";

/** Buttons per the handoff (primary accent / secondary white / destructive outline). */
export const BTN_PRIMARY = buttonVariants({ size: "lg" });
export const BTN_PRIMARY_DENSE = buttonVariants({ size: "sm" });
export const BTN_SECONDARY = buttonVariants({ variant: "secondary", size: "lg" });
export const BTN_SECONDARY_DENSE = buttonVariants({ variant: "secondary", size: "sm" });
export const BTN_DESTRUCTIVE = buttonVariants({ variant: "destructiveOutline", size: "lg" });
export const BTN_DESTRUCTIVE_DENSE = buttonVariants({ variant: "destructiveOutline", size: "sm" });

/** 1b form control (select/input) look for filter pills and dialog fields. */
export const FIELD_CONTROL =
  "h-10 w-full rounded-[10px] border border-line bg-white px-3 text-[13px] text-ink-700 outline-none transition-colors placeholder:text-ink-400 focus-visible:border-brand-blue focus-visible:ring-2 focus-visible:ring-brand-blue/25";

/** Uppercase micro-label used on filters, table headers and stat tiles. */
export const MICRO_LABEL = "text-[11px] font-bold uppercase tracking-[0.04em] text-ink-400";

export type SemanticTone = "info" | "success" | "warning" | "destructive" | "neutral";

/** Full-radius semantic pill with status dot — delegates to THE StatusPill. */
export function TonePill({
  tone,
  children,
  size = "md",
}: {
  tone: SemanticTone;
  children: ReactNode;
  size?: "sm" | "md";
}) {
  return (
    <StatusPill tone={tone} size={size}>
      {children}
    </StatusPill>
  );
}

/**
 * A decision-support warning attached to one leave request — negative balance,
 * a request larger than what is left, payroll impact.
 *
 * It lives here rather than in the dashboard because the same warnings have to
 * reach every surface that can approve: the table, the mobile list and the
 * pinned queue. They used to render in the queue only, so approving from the
 * table happened blind.
 */
export type LeaveConflictFlag = { key: string; label: string; tone: SemanticTone };

export function LeaveFlagPills({
  flags,
  className,
}: {
  flags: LeaveConflictFlag[];
  className?: string;
}) {
  if (flags.length === 0) return null;
  return (
    <div className={`flex flex-wrap gap-1.5 ${className ?? ""}`}>
      {flags.map((f) => (
        <TonePill key={f.key} tone={f.tone} size="sm">
          {f.label}
        </TonePill>
      ))}
    </div>
  );
}

/** Calendar / legend color coding per leave TYPE (5b spec). */
export const LEAVE_TYPE_TONES: Record<
  LeaveType,
  { text: string; bg: string; border: string; dot: string }
> = {
  PUSHIM_VJETOR: {
    text: "text-brand-blue",
    bg: "bg-[#eff6ff]",
    border: "border-[#bfdbfe]",
    dot: "bg-brand-blue",
  },
  PUSHIM_MJEKESOR: {
    text: "text-[#dc2626]",
    bg: "bg-[#fef2f2]",
    border: "border-[#fecaca]",
    dot: "bg-[#dc2626]",
  },
  PUSHIM_PERSONAL: {
    text: "text-[#7c3aed]",
    bg: "bg-[#f5f3ff]",
    border: "border-[#ddd6fe]",
    dot: "bg-[#7c3aed]",
  },
  PUSHIM_LEHONIE: {
    text: "text-[#0d9488]",
    bg: "bg-[#f0fdfa]",
    border: "border-[#99f6e4]",
    dot: "bg-[#0d9488]",
  },
  PUSHIM_PA_PAGESE: {
    text: "text-ink-500",
    bg: "bg-fill",
    border: "border-line",
    dot: "bg-ink-500",
  },
  TJETER: {
    text: "text-ink-600",
    bg: "bg-fill",
    border: "border-line",
    dot: "bg-ink-400",
  },
};

/** Small per-type pill (dot + label) used on queue rows and lists. */
export function LeaveTypePill({ type, label }: { type: LeaveType; label: string }) {
  const t = LEAVE_TYPE_TONES[type];
  return (
    <span
      className={`inline-flex h-5 items-center gap-1.5 whitespace-nowrap rounded-full px-2 text-[11px] font-semibold ${t.bg} ${t.text}`}
    >
      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${t.dot}`} aria-hidden />
      {label}
    </span>
  );
}

/** 36px initials avatar tile (navy). */
export function InitialsAvatar({ name }: { name: string }) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return (
    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-brand-navy text-[12px] font-bold text-white">
      {initials || "—"}
    </span>
  );
}
