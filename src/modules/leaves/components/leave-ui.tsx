import type { ReactNode } from "react";
import type { LeaveType } from "@prisma/client";

/**
 * Shared presentational tokens for the Pushimet module (design handoff "1b", screens 5a/5b).
 * Presentation only — no data logic lives here.
 */

/** Standard 1b card shell: white, 1px #e2e8f0 border, radius 12px, flat shadow. */
export const LEAVE_CARD =
  "rounded-xl border border-[#e2e8f0] bg-white shadow-[0_1px_3px_rgba(15,23,42,0.05)]";

/** Buttons per the handoff (primary accent / secondary white / destructive outline). */
export const BTN_PRIMARY =
  "inline-flex h-10 items-center justify-center gap-1.5 rounded-[10px] bg-brand-blue px-[18px] text-[13.5px] font-semibold text-white transition-colors hover:bg-[#1d4ed8] disabled:pointer-events-none disabled:opacity-50";
export const BTN_PRIMARY_DENSE =
  "inline-flex h-8 items-center justify-center gap-1 rounded-lg bg-brand-blue px-3 text-[12.5px] font-semibold text-white transition-colors hover:bg-[#1d4ed8] disabled:pointer-events-none disabled:opacity-50";
export const BTN_SECONDARY =
  "inline-flex h-10 items-center justify-center gap-1.5 rounded-[10px] border border-[#e2e8f0] bg-white px-4 text-[13px] font-semibold text-[#334155] transition-colors hover:bg-[#eef2f7] disabled:pointer-events-none disabled:opacity-50";
export const BTN_SECONDARY_DENSE =
  "inline-flex h-8 items-center justify-center gap-1 rounded-lg border border-[#e2e8f0] bg-white px-3 text-[12.5px] font-semibold text-[#334155] transition-colors hover:bg-[#eef2f7] disabled:pointer-events-none disabled:opacity-50";
export const BTN_DESTRUCTIVE =
  "inline-flex h-10 items-center justify-center gap-1.5 rounded-[10px] border border-[#fee2e2] bg-white px-4 text-[13px] font-semibold text-[#dc2626] transition-colors hover:bg-[#fef2f2] disabled:pointer-events-none disabled:opacity-50";
export const BTN_DESTRUCTIVE_DENSE =
  "inline-flex h-8 items-center justify-center gap-1 rounded-lg border border-[#fee2e2] bg-white px-3 text-[12.5px] font-semibold text-[#dc2626] transition-colors hover:bg-[#fef2f2] disabled:pointer-events-none disabled:opacity-50";

/** 1b form control (select/input) look for filter pills and dialog fields. */
export const FIELD_CONTROL =
  "h-10 w-full rounded-[10px] border border-[#e2e8f0] bg-white px-3 text-[13px] text-[#334155] outline-none transition-colors placeholder:text-[#94a3b8] focus-visible:border-brand-blue focus-visible:ring-2 focus-visible:ring-brand-blue/25";

/** Uppercase micro-label used on filters, table headers and stat tiles. */
export const MICRO_LABEL = "text-[11px] font-bold uppercase tracking-[0.04em] text-[#94a3b8]";

export type SemanticTone = "info" | "success" | "warning" | "destructive" | "neutral";

const PILL_TONES: Record<SemanticTone, { chip: string; dot: string }> = {
  info: { chip: "bg-[#eff6ff] text-brand-blue", dot: "bg-brand-blue" },
  success: { chip: "bg-[#ecfdf5] text-[#15803d]", dot: "bg-[#16a34a]" },
  warning: { chip: "bg-[#fffbeb] text-[#b45309]", dot: "bg-[#d97706]" },
  destructive: { chip: "bg-[#fef2f2] text-[#dc2626]", dot: "bg-[#dc2626]" },
  neutral: { chip: "bg-[#f1f5f9] text-[#64748b]", dot: "bg-[#94a3b8]" },
};

/** Full-radius semantic pill with status dot (chips/badges spec). */
export function TonePill({
  tone,
  children,
  size = "md",
}: {
  tone: SemanticTone;
  children: ReactNode;
  size?: "sm" | "md";
}) {
  const t = PILL_TONES[tone];
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full font-semibold ${t.chip} ${
        size === "sm" ? "h-5 px-2 text-[11px]" : "h-6 px-[11px] text-[12px]"
      }`}
    >
      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${t.dot}`} aria-hidden />
      {children}
    </span>
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
    text: "text-[#64748b]",
    bg: "bg-[#f1f5f9]",
    border: "border-[#e2e8f0]",
    dot: "bg-[#64748b]",
  },
  TJETER: {
    text: "text-[#475569]",
    bg: "bg-[#f1f5f9]",
    border: "border-[#e2e8f0]",
    dot: "bg-[#94a3b8]",
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
