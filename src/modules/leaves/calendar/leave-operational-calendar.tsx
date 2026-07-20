"use client";

import type { LeaveType } from "@prisma/client";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { LEAVE_TYPE_LABELS_SQ } from "@/modules/leaves/helpers/leave-type-metadata";
import { LEAVE_STATUS_LABELS_SQ } from "@/modules/leaves/helpers/leave-status-labels";
import { LEAVE_CARD, LEAVE_TYPE_TONES } from "@/modules/leaves/components/leave-ui";
import type { PushimetCalendarChipDto } from "@/modules/leaves/types/pushimet";

const WEEK_HEADERS = ["Hën", "Mar", "Mër", "Enj", "Pre", "Sht", "Die"];

const LEGEND_TYPES: LeaveType[] = [
  "PUSHIM_VJETOR",
  "PUSHIM_MJEKESOR",
  "PUSHIM_PERSONAL",
  "PUSHIM_LEHONIE",
  "PUSHIM_PA_PAGESE",
  "TJETER",
];

const NAV_BTN =
  "inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[#e2e8f0] bg-white text-[#334155] transition-colors hover:bg-[#eef2f7]";

function utcDayStart(iso: string): Date {
  const d = new Date(iso);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function overlapsDay(dayUtc: Date, chip: PushimetCalendarChipDto): boolean {
  const s = utcDayStart(chip.startDateIso);
  const e = utcDayStart(chip.endDateIso);
  return dayUtc >= s && dayUtc <= e;
}

export function LeaveOperationalCalendar(props: {
  year: number;
  month: number;
  chips: PushimetCalendarChipDto[];
  prevHref?: string;
  nextHref?: string;
}) {
  const { year, month, chips } = props;
  const first = new Date(Date.UTC(year, month - 1, 1));
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const lead = (first.getUTCDay() + 6) % 7;

  const cells: (number | null)[] = [];
  for (let i = 0; i < lead; i++) cells.push(null);
  for (let d = 1; d <= lastDay; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  while (cells.length < 42) cells.push(null);

  const label = first.toLocaleDateString("sq-AL", { month: "long", year: "numeric", timeZone: "UTC" });

  const now = new Date();
  const todayDay =
    now.getUTCFullYear() === year && now.getUTCMonth() + 1 === month ? now.getUTCDate() : null;

  return (
    <div className={`overflow-hidden ${LEAVE_CARD}`}>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#eef2f7] px-4 py-3">
        <div className="min-w-0">
          <h3 className="text-[13.5px] font-bold capitalize tracking-[-0.01em] text-[#0f172a]">{label}</h3>
          <p className="text-[11px] text-[#94a3b8]">
            Miratuar / në pritje — mbivendosjet duken në të njëjtën qeli
          </p>
        </div>
        {props.prevHref && props.nextHref ? (
          <div className="flex shrink-0 items-center gap-1.5">
            <Link href={props.prevHref} prefetch={false} aria-label="Muaji paraprak" className={NAV_BTN}>
              <ChevronLeft className="h-4 w-4" aria-hidden />
            </Link>
            <Link href={props.nextHref} prefetch={false} aria-label="Muaji tjetër" className={NAV_BTN}>
              <ChevronRight className="h-4 w-4" aria-hidden />
            </Link>
          </div>
        ) : null}
      </div>

      <div className="p-3">
        <div className="grid grid-cols-7 gap-px overflow-hidden rounded-lg border border-[#eef2f7] bg-[#eef2f7] text-[11px]">
          {WEEK_HEADERS.map((h) => (
            <div
              key={h}
              className="bg-[#f8fafc] px-1 py-2 text-center text-[10.5px] font-bold uppercase tracking-[0.05em] text-[#94a3b8]"
            >
              {h}
            </div>
          ))}
          {cells.map((day, idx) => {
            const weekend = idx % 7 >= 5;
            if (day == null) {
              return <div key={`e-${idx}`} className="min-h-[88px] bg-[#f8fafc] max-md:min-h-[64px]" />;
            }
            const isToday = day === todayDay;
            const dayUtc = new Date(Date.UTC(year, month - 1, day));
            const dayChips = chips.filter((c) => overlapsDay(dayUtc, c));
            return (
              <div
                key={day}
                className={`flex min-h-[88px] flex-col gap-1 p-1.5 align-top max-md:min-h-[64px] ${
                  weekend ? "bg-[#fbfcfe]" : "bg-white"
                } ${isToday ? "ring-2 ring-inset ring-brand-blue" : ""}`}
              >
                {isToday ? (
                  <span className="inline-flex h-5 w-5 items-center justify-center self-start rounded-full bg-brand-blue text-[10.5px] font-bold tabular-nums text-white">
                    {day}
                  </span>
                ) : (
                  <span className="tabular-nums text-[#94a3b8]">{day}</span>
                )}
                <div className="flex flex-col gap-0.5 overflow-hidden">
                  {dayChips.slice(0, 3).map((c) => {
                    const tone = LEAVE_TYPE_TONES[c.type];
                    const pending = c.status === "PENDING";
                    return (
                      <Link
                        key={`${c.id}-${day}`}
                        href={`/pushimet/${c.id}`}
                        title={`${c.employeeName} · ${LEAVE_TYPE_LABELS_SQ[c.type]} · ${LEAVE_STATUS_LABELS_SQ[c.status]}`}
                        className={`truncate rounded-md border px-1 py-0.5 text-[10.5px] font-semibold leading-tight transition-opacity hover:opacity-80 ${tone.text} ${tone.border} ${
                          pending ? "border-dashed bg-white" : tone.bg
                        }`}
                      >
                        <span className="block truncate md:hidden">
                          {c.employeeName
                            .split(/\s+/)
                            .filter(Boolean)
                            .map((p) => p[0])
                            .join("")
                            .slice(0, 3)
                            .toUpperCase()}
                        </span>
                        <span className="hidden truncate md:block">{c.employeeName}</span>
                      </Link>
                    );
                  })}
                  {dayChips.length > 3 ? (
                    <span className="text-[10px] text-[#94a3b8]">+{dayChips.length - 3} më shumë</span>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 px-1 text-[11px] font-medium text-[#64748b]">
          {LEGEND_TYPES.map((t) => (
            <span key={t} className="inline-flex items-center gap-1.5">
              <span className={`h-2 w-2 rounded-full ${LEAVE_TYPE_TONES[t].dot}`} aria-hidden />
              {LEAVE_TYPE_LABELS_SQ[t]}
            </span>
          ))}
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-[3px] border border-dashed border-[#94a3b8] bg-white" aria-hidden />
            Në pritje (e vijëzuar)
          </span>
        </div>
      </div>
    </div>
  );
}
