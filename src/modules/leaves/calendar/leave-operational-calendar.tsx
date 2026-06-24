"use client";

import type { LeaveRequestStatus } from "@prisma/client";
import Link from "next/link";
import { LEAVE_TYPE_LABELS_SQ } from "@/modules/leaves/helpers/leave-type-metadata";
import { LEAVE_STATUS_LABELS_SQ } from "@/modules/leaves/helpers/leave-status-labels";
import type { PushimetCalendarChipDto } from "@/modules/leaves/types/pushimet";

const WEEK_HEADERS = ["Hën", "Mar", "Mër", "Enj", "Pre", "Sht", "Die"];

function utcDayStart(iso: string): Date {
  const d = new Date(iso);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function overlapsDay(dayUtc: Date, chip: PushimetCalendarChipDto): boolean {
  const s = utcDayStart(chip.startDateIso);
  const e = utcDayStart(chip.endDateIso);
  return dayUtc >= s && dayUtc <= e;
}

function statusTone(status: LeaveRequestStatus): string {
  switch (status) {
    case "APPROVED":
      return "bg-emerald-500/15 text-emerald-900 dark:text-emerald-100 border-emerald-500/35";
    case "PENDING":
      return "bg-amber-500/15 text-amber-950 dark:text-amber-100 border-amber-500/35";
    case "REJECTED":
      return "bg-rose-500/10 text-rose-900 dark:text-rose-100 border-rose-500/25";
    default:
      return "bg-muted text-muted-foreground border-border";
  }
}

export function LeaveOperationalCalendar(props: {
  year: number;
  month: number;
  chips: PushimetCalendarChipDto[];
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

  return (
    <div className="rounded-xl border border-border bg-card p-3 shadow-sm">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 px-1">
        <h3 className="text-sm font-semibold capitalize text-foreground">{label}</h3>
        <p className="text-[11px] text-muted-foreground">Miratuar / në pritje — mbivendosjet duken në të njëjtën qeli</p>
      </div>
      <div className="grid grid-cols-7 gap-px rounded-lg bg-border text-[11px]">
        {WEEK_HEADERS.map((h) => (
          <div key={h} className="bg-muted/60 px-1 py-2 text-center font-medium text-muted-foreground">
            {h}
          </div>
        ))}
        {cells.map((day, idx) => {
          if (day == null) {
            return <div key={`e-${idx}`} className="min-h-[88px] bg-muted/20 max-md:min-h-[64px]" />;
          }
          const dayUtc = new Date(Date.UTC(year, month - 1, day));
          const dayChips = chips.filter((c) => overlapsDay(dayUtc, c));
          return (
            <div
              key={day}
              className="flex min-h-[88px] flex-col gap-1 bg-background p-1.5 align-top max-md:min-h-[64px]"
            >
              <span className="tabular-nums text-muted-foreground">{day}</span>
              <div className="flex flex-col gap-0.5 overflow-hidden">
                {dayChips.slice(0, 3).map((c) => (
                  <Link
                    key={`${c.id}-${day}`}
                    href={`/pushimet/${c.id}`}
                    title={`${c.employeeName} · ${LEAVE_TYPE_LABELS_SQ[c.type]} · ${LEAVE_STATUS_LABELS_SQ[c.status]}`}
                    className={`truncate rounded border px-1 py-0.5 font-medium leading-tight hover:opacity-90 ${statusTone(c.status)}`}
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
                ))}
                {dayChips.length > 3 ? (
                  <span className="text-[10px] text-muted-foreground">+{dayChips.length - 3} më shumë</span>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
