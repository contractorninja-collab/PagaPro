import { useCallback, useEffect, useRef, useState } from "react";

/**
 * The payroll grid's shared cell language — extracted so the contractor
 * spreadsheet is built from the SAME pieces as the employee one, not a
 * lookalike that drifts.
 */

/**
 * Cell states:
 *   neutral  — resting; amber — deviates from its baseline; blue — in flight;
 *   emerald  — just saved, fading back to neutral.
 */
export type CellState = "idle" | "saving" | "saved";

export const CELL_BASE =
  "box-border h-[26px] w-full min-w-[52px] rounded-md border px-2 text-right text-xs leading-tight outline-none transition-colors [font-variant-numeric:tabular-nums] focus:border-brand-blue focus:bg-white disabled:cursor-not-allowed disabled:opacity-60";

export function cellTone(state: CellState, deviates: boolean): string {
  if (state === "saving") return "border-brand-blue bg-white text-ink-700";
  if (state === "saved") return "border-[#6ee7b7] bg-[#ecfdf5] text-[#047857]";
  if (deviates) return "border-[#fde68a] bg-[#fffbeb] text-[#b45309]";
  return "border-line bg-fill-faint text-ink-600";
}

/** Holds the "just saved" tint briefly, then clears it. */
export function useSavedPulse(): [CellState, (s: CellState) => void] {
  const [state, setState] = useState<CellState>("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const set = useCallback((next: CellState) => {
    setState(next);
    if (timer.current) clearTimeout(timer.current);
    if (next === "saved") timer.current = setTimeout(() => setState("idle"), 1400);
  }, []);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  return [state, set];
}

export function parseNum(s: string): number | null {
  const n = Number(String(s).trim().replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

export function sumPlainEuro(vals: string[]): string {
  let total = 0;
  for (const v of vals) {
    const n = parseNum(v);
    if (n != null) total += n;
  }
  return total.toFixed(2);
}
