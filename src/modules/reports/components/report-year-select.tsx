"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

/**
 * The page's only control. Every section shares this year, so the three charts
 * always describe the same period — the old page had a six-field filter form
 * that produced a file rather than an answer.
 */
export function ReportYearSelect({ year, years }: { year: number; years: number[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <label className="flex items-center gap-2">
      <span className="text-[11px] font-bold uppercase tracking-[0.04em] text-[#94a3b8]">Viti</span>
      <select
        value={String(year)}
        disabled={pending}
        onChange={(e) => {
          const next = e.target.value;
          startTransition(() => router.push(`/raportet?year=${next}`));
        }}
        aria-label="Zgjidh vitin e raportimit"
        className="h-10 rounded-[10px] border border-[#e2e8f0] bg-white px-3 text-[13px] font-semibold tabular-nums text-[#334155] outline-none transition-colors focus-visible:border-brand-blue focus-visible:ring-2 focus-visible:ring-brand-blue/25 disabled:opacity-60"
      >
        {years.map((y) => (
          <option key={y} value={String(y)}>
            {y}
          </option>
        ))}
      </select>
    </label>
  );
}
