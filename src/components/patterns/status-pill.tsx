import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * THE status pill. Every semantic chip in the product renders through this —
 * TonePill (leaves), DocChip (documents), SubBarStatus (shell), the payroll
 * badge and the largimet chips all delegate here, so a status can never again
 * be two colors on two screens.
 *
 * Palette = the tone.* tokens in tailwind.config.ts. `locked` is the one
 * non-tonal state: solid navy, used for payroll LOCKED and archived-final
 * documents.
 */
export type StatusTone = "info" | "success" | "warning" | "destructive" | "neutral" | "locked";

const TONES: Record<StatusTone, { chip: string; dot: string }> = {
  info: { chip: "bg-tone-info-bg text-brand-blue", dot: "bg-brand-blue" },
  success: { chip: "bg-tone-success-bg text-tone-success-fg", dot: "bg-tone-success-dot" },
  warning: { chip: "bg-tone-warning-bg text-tone-warning-fg", dot: "bg-tone-warning-dot" },
  destructive: { chip: "bg-tone-danger-bg text-tone-danger-fg", dot: "bg-tone-danger-fg" },
  neutral: { chip: "bg-fill text-ink-500", dot: "bg-ink-400" },
  locked: { chip: "bg-brand-navy text-white", dot: "bg-white" },
};

export function StatusPill({
  tone,
  children,
  size = "md",
  withDot = true,
  icon,
  className,
}: {
  tone: StatusTone;
  children: ReactNode;
  size?: "sm" | "md";
  /** The dot is the family signature — drop it only for pure-text badges. */
  withDot?: boolean;
  /** Replaces the dot (the payroll Lock case). */
  icon?: ReactNode;
  className?: string;
}) {
  const t = TONES[tone];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full font-semibold",
        size === "sm" ? "h-5 px-2 text-[11px]" : "h-6 px-[11px] text-[12px]",
        t.chip,
        className,
      )}
    >
      {icon ?? (withDot ? <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", t.dot)} aria-hidden /> : null)}
      {children}
    </span>
  );
}
