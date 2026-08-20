"use client";

import { useMemo, useState } from "react";
import { CheckCircle2, Circle, FileText, Sheet } from "lucide-react";
import type { PayrollDetailDto } from "@/modules/payroll/services/payroll-period-service";
import {
  payrollTimelineLabel,
  payrollTimelineTone,
  type PayrollTimelineTone,
} from "@/modules/payroll/constants/timeline";
import { CARD, CARD_TITLE } from "@/modules/payroll/components/payroll-card";
import { cn } from "@/lib/utils";

/**
 * Activity and audit were two separate lists with two separate empty states,
 * describing one history. They are one feed here, filterable, on a rail — and
 * the verbs are rendered as Albanian sentences rather than the raw constants
 * (`PAYROLL_ATK_ARCHIVED`) the old list printed at the user.
 */

const SERVER_CAP = 50;

type Filter = "all" | "activity" | "audit";

interface FeedItem {
  id: string;
  source: "activity" | "audit";
  label: string;
  detail: string | null;
  at: string;
  tone: PayrollTimelineTone;
}

const TONE_STYLES: Record<PayrollTimelineTone, { dot: string; icon: typeof Circle }> = {
  status: { dot: "border-[#86efac] bg-[#dcfce7] text-[#166534]", icon: CheckCircle2 },
  document: { dot: "border-[#bfdbfe] bg-[#dbeafe] text-[#1e40af]", icon: FileText },
  atk: { dot: "border-[#fde68a] bg-[#fef3c7] text-[#92400e]", icon: Sheet },
  neutral: { dot: "border-[#e2e8f0] bg-[#f1f5f9] text-[#64748b]", icon: Circle },
};

/** "Sot" / "Dje" / a date — a wall of identical timestamps is unreadable. */
function dayHeading(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

  if (sameDay(d, today)) return "Sot";
  const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
  if (sameDay(d, yesterday)) return "Dje";

  return d.toLocaleDateString("sq-XK", { day: "2-digit", month: "long", year: "numeric" });
}

function timeOnly(iso: string): string {
  return new Date(iso).toLocaleTimeString("sq-XK", { hour: "2-digit", minute: "2-digit" });
}

export function PayrollHistoryTab(props: {
  timeline: PayrollDetailDto["timeline"];
  auditTrail: PayrollDetailDto["auditTrail"];
}) {
  const [filter, setFilter] = useState<Filter>("all");

  const items = useMemo<FeedItem[]>(() => {
    const activity: FeedItem[] = props.timeline.map((t) => ({
      id: `a-${t.id}`,
      source: "activity",
      label: payrollTimelineLabel(t.verb),
      detail: t.summary,
      at: t.occurredAt,
      tone: payrollTimelineTone(t.verb),
    }));

    const audit: FeedItem[] = props.auditTrail.map((a) => ({
      id: `u-${a.id}`,
      source: "audit",
      label: payrollTimelineLabel(a.action),
      detail: null,
      at: a.createdAt,
      tone: "neutral",
    }));

    return [...activity, ...audit].sort((x, y) => y.at.localeCompare(x.at));
  }, [props.timeline, props.auditTrail]);

  const visible = items.filter((i) => filter === "all" || i.source === filter);

  const groups: Array<{ heading: string; rows: FeedItem[] }> = [];
  for (const item of visible) {
    const heading = dayHeading(item.at);
    const last = groups[groups.length - 1];
    if (last && last.heading === heading) last.rows.push(item);
    else groups.push({ heading, rows: [item] });
  }

  const capped = props.timeline.length >= SERVER_CAP || props.auditTrail.length >= SERVER_CAP;

  const chips: Array<{ key: Filter; label: string; count: number }> = [
    { key: "all", label: "Të gjitha", count: items.length },
    { key: "activity", label: "Veprime", count: props.timeline.length },
    { key: "audit", label: "Audit", count: props.auditTrail.length },
  ];

  return (
    <section className={CARD}>
      <div className={cn(CARD_TITLE, "flex flex-wrap items-center justify-between gap-3")}>
        <span>Historia</span>
        <div className="flex gap-1">
          {chips.map((c) => (
            <button
              key={c.key}
              type="button"
              onClick={() => setFilter(c.key)}
              className={cn(
                "rounded-full px-3 py-1 text-[11.5px] font-semibold transition-colors",
                filter === c.key
                  ? "bg-[#0f172a] text-white"
                  : "bg-[#f1f5f9] text-[#64748b] hover:bg-[#e2e8f0]",
              )}
            >
              {c.label} {c.count}
            </button>
          ))}
        </div>
      </div>

      {visible.length === 0 ? (
        <p className="px-5 py-8 text-center text-sm text-[#64748b]">Nuk ka ngjarje ende.</p>
      ) : (
        <div className="px-5 py-4">
          {groups.map((g) => (
            <div key={g.heading} className="mb-4 last:mb-0">
              <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.04em] text-[#94a3b8]">
                {g.heading}
              </p>
              <ul className="relative space-y-3 border-l border-[#e2e8f0] pl-5">
                {g.rows.map((item) => {
                  const tone = TONE_STYLES[item.tone];
                  const Icon = tone.icon;
                  return (
                    <li key={item.id} className="relative">
                      <span
                        className={cn(
                          "absolute -left-[26px] flex h-[18px] w-[18px] items-center justify-center rounded-full border",
                          tone.dot,
                        )}
                        aria-hidden
                      >
                        <Icon className="h-2.5 w-2.5" />
                      </span>
                      <div className="flex flex-wrap items-baseline gap-x-2">
                        <span className="text-[13px] font-semibold text-[#0f172a]">{item.label}</span>
                        {item.source === "audit" ? (
                          <span className="rounded bg-[#f1f5f9] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#94a3b8]">
                            Audit
                          </span>
                        ) : null}
                        <span className="text-xs text-[#94a3b8] [font-variant-numeric:tabular-nums]">
                          {timeOnly(item.at)}
                        </span>
                      </div>
                      {item.detail ? (
                        <p className="mt-0.5 text-[13px] leading-relaxed text-[#475569]">{item.detail}</p>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}

          {capped ? (
            <p className="border-t border-[#f1f5f9] pt-3 text-xs text-[#94a3b8]">
              Shfaqen {SERVER_CAP} ngjarjet e fundit.
            </p>
          ) : null}
        </div>
      )}
    </section>
  );
}
