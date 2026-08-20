"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * The two pieces every chart in the app needs around it.
 *
 * They live here rather than inside one page so the accessibility contract —
 * a chart is an image with a label, and the finding is also written out in
 * words — holds wherever a chart is used, instead of being re-invented (or
 * forgotten) per module. Recharts renders an SVG a screen reader cannot read,
 * and a phone often can't read a dense 12-point axis either; the sentence below
 * the chart serves both.
 */

import { CARD } from "@/components/patterns/surface";

/** Placeholder with the same footprint as the chart, so nothing jumps on load. */
export function ChartSkeleton({ height }: { height: number }) {
  return (
    <div
      className="flex animate-pulse items-end gap-2 rounded-lg bg-[#f8fafc] p-4"
      style={{ height }}
      aria-hidden
    >
      {[45, 70, 35, 85, 55, 75, 40].map((h, i) => (
        <div key={i} className="flex-1 rounded-t bg-[#e2e8f0]" style={{ height: `${h}%` }} />
      ))}
    </div>
  );
}

/**
 * A chart plus the sentence a screen reader (or a phone) gets instead.
 * `summary` is the finding, not a description of the axes.
 */
export function ChartFrame({
  summary,
  fallback,
  className,
  children,
}: {
  summary: string;
  fallback: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn("overflow-hidden p-4", CARD, className)}>
      <div role="img" aria-label={summary} className="min-w-0">
        {children}
      </div>
      <p className="mt-2 border-t border-[#eef2f7] pt-2.5 text-[12.5px] leading-relaxed text-[#64748b]">
        {fallback}
      </p>
    </div>
  );
}
