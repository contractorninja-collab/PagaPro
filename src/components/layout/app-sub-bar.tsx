import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * 1b sub-bar — the white breadcrumb/title/actions strip between the top-nav and the
 * canvas body. Full-bleed: it breaks out of the layout's canvas padding via negative
 * margins, so render it as the FIRST child of a page's content.
 *
 * - List pages: pass `eyebrow` + `title` (+ optional `description`, `actions`).
 * - Detail pages: pass `backHref` + `backLabel` for the breadcrumb, plus `title`,
 *   optional `status` pill and `actions`; set `dense` for the tighter detail padding.
 */
export function AppSubBar({
  eyebrow,
  title,
  description,
  backHref,
  backLabel,
  status,
  actions,
  dense = false,
}: {
  eyebrow?: string;
  title: ReactNode;
  description?: ReactNode;
  backHref?: string;
  backLabel?: string;
  status?: ReactNode;
  actions?: ReactNode;
  dense?: boolean;
}) {
  return (
    <div
      className={cn(
        "-mx-4 -mt-4 mb-6 border-b border-[#e2e8f0] bg-white px-4 md:-mx-10 md:-mt-6 md:px-10",
        dense ? "pb-[18px] pt-4" : "py-[22px]",
      )}
    >
      {backHref ? (
        <Link
          href={backHref}
          className="mb-2.5 inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-[#94a3b8] transition-colors hover:text-[#475569]"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
          {backLabel ?? "Kthehu"}
        </Link>
      ) : eyebrow ? (
        <p className="mb-1.5 text-[12px] font-semibold uppercase tracking-[0.06em] text-[#94a3b8]">
          {eyebrow}
        </p>
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between sm:gap-6">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <h1
              className={cn(
                "m-0 font-extrabold tracking-[-0.025em] text-brand-navy",
                dense ? "text-[26px] leading-tight" : "text-[30px] leading-tight",
              )}
            >
              {title}
            </h1>
            {status}
          </div>
          {description ? (
            <p className="mt-1.5 max-w-3xl text-[13px] leading-relaxed text-[#64748b]">{description}</p>
          ) : null}
        </div>

        {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2.5">{actions}</div> : null}
      </div>
    </div>
  );
}

/** Small semantic status pill for the sub-bar (info | success | warning | destructive | neutral | locked). */
export function SubBarStatus({
  tone = "info",
  children,
}: {
  tone?: "info" | "success" | "warning" | "destructive" | "neutral" | "locked";
  children: ReactNode;
}) {
  const tones = {
    info: { chip: "bg-[#eff6ff] text-brand-blue", dot: "bg-brand-blue" },
    success: { chip: "bg-[#ecfdf5] text-[#15803d]", dot: "bg-[#16a34a]" },
    warning: { chip: "bg-[#fffbeb] text-[#b45309]", dot: "bg-[#d97706]" },
    destructive: { chip: "bg-[#fef2f2] text-destructive", dot: "bg-destructive" },
    neutral: { chip: "bg-[#f1f5f9] text-[#64748b]", dot: "bg-[#94a3b8]" },
    locked: { chip: "bg-brand-navy text-white", dot: "bg-white" },
  } satisfies Record<string, { chip: string; dot: string }>;
  const t = tones[tone];
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center gap-1.5 rounded-full px-[11px] text-[12px] font-semibold",
        t.chip,
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", t.dot)} aria-hidden />
      {children}
    </span>
  );
}
