"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { LEAVE_CARD, LEAVE_TYPE_TONES } from "@/modules/leaves/components/leave-ui";
import { LEAVE_TYPE_LABELS_SQ } from "@/modules/leaves/helpers/leave-type-metadata";
import { matchesQuery } from "@/lib/search";
import {
  assignLanes,
  buildWallchartDays,
  clampBar,
  countCoverage,
  monthSlice,
  peakCoverage,
  type WallchartDay,
} from "@/modules/leaves/wallchart/wallchart-layout";
import type {
  PushimetCalendarChipDto,
  PushimetWallchartEmployeeDto,
} from "@/modules/leaves/types/pushimet";
import type { LeaveType } from "@prisma/client";

const NAV_BTN =
  "inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[#e2e8f0] bg-white text-[#334155] transition-colors hover:bg-[#eef2f7]";

const SEG_BTN = "h-[30px] px-3 text-[12px] font-semibold transition-colors";

/** Mon-first weekday initials, matching the layout engine's weekday index. */
const WEEKDAYS = ["Hë", "Ma", "Më", "En", "Pr", "Sh", "Di"];

const LEGEND_TYPES: LeaveType[] = [
  "PUSHIM_VJETOR",
  "PUSHIM_MJEKESOR",
  "PUSHIM_PERSONAL",
  "PUSHIM_LEHONIE",
  "PUSHIM_PA_PAGESE",
  "TJETER",
];

const NAME_COL = "220px";
const LANE_PX = 24;

/**
 * The chart is bounded and scrolls inside itself. Unbounded, it drew one row
 * per employee down the page — eighteen people pushed everything below it off
 * screen, and a company of two hundred made the rest of Pushimet unreachable
 * without a very long scroll. The header and the coverage strip stay pinned, so
 * scrolling never costs you the day you are reading.
 *
 * clamp() rather than a flat pixel height: short rosters still shrink to fit
 * and never leave a tall empty box, tall ones stop at a readable window.
 */
const CHART_VIEWPORT = "max-h-[clamp(240px,52vh,560px)]";

/** Sentinel for the "no department" bucket, since the column is nullable. */
const NO_DEPARTMENT = "__none__";

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function isoToDay(iso: string): string {
  return iso.slice(0, 10);
}

/** "12–16 gusht" for the bar tooltip. */
function rangeSq(startIso: string, endIso: string): string {
  const s = new Date(startIso);
  const e = new Date(endIso);
  const month = e.toLocaleDateString("sq-AL", { month: "long", timeZone: "UTC" });
  if (s.getTime() === e.getTime()) return `${e.getUTCDate()} ${month}`;
  return `${s.getUTCDate()}–${e.getUTCDate()} ${month}`;
}

interface WallchartBar {
  id: string;
  employeeId: string;
  type: LeaveType;
  pending: boolean;
  startIso: string;
  endIso: string;
  employeeName: string;
  workingDays: string | null;
}

/**
 * The team wallchart — Band 2 of the approved Pushimet redesign. Rows are
 * every current employee grouped by department; columns are days; absences are
 * bars. It replaces the old month-cell calendar, which could only answer "who
 * is off on day X" one cell at a time and never showed who is *present*.
 */
export function LeaveWallchart(props: {
  year: number;
  month: number;
  employees: PushimetWallchartEmployeeDto[];
  /** Absences overlapping the six-week grid, already URL-filtered by the page. */
  chips: PushimetCalendarChipDto[];
  holidayIsoDates: string[];
  todayIso: string;
  prevHref: string;
  nextHref: string;
  todayHref: string;
}) {
  const [view, setView] = useState<"month" | "sixWeeks">("month");
  const [who, setWho] = useState<"all" | "away">("all");
  const [search, setSearch] = useState("");
  const [department, setDepartment] = useState("");

  const holidays = useMemo(() => new Set(props.holidayIsoDates), [props.holidayIsoDates]);

  const gridDays = useMemo(() => buildWallchartDays(props.year, props.month), [props.year, props.month]);
  const days: WallchartDay[] = useMemo(() => {
    if (view === "sixWeeks") return gridDays;
    const { offset, length } = monthSlice(gridDays);
    return gridDays.slice(offset, offset + length);
  }, [gridDays, view]);

  /**
   * Only decisions and requests belong on a planning chart: approved solid,
   * pending dashed. Draft/rejected/cancelled rows live in the list below —
   * drawing them here would show absences that will never happen.
   */
  const bars: WallchartBar[] = useMemo(
    () =>
      props.chips
        .filter((c) => c.status === "APPROVED" || c.status === "PENDING")
        .map((c) => ({
          id: c.id,
          employeeId: c.employeeId,
          type: c.type,
          pending: c.status === "PENDING",
          startIso: isoToDay(c.startDateIso),
          endIso: isoToDay(c.endDateIso),
          employeeName: c.employeeName,
          workingDays: c.workingDays,
        })),
    [props.chips],
  );

  const barsByEmployee = useMemo(() => {
    const map = new Map<string, WallchartBar[]>();
    for (const bar of bars) {
      const list = map.get(bar.employeeId);
      if (list) list.push(bar);
      else map.set(bar.employeeId, [bar]);
    }
    return map;
  }, [bars]);

  /** Coverage counts approved absences only — pending is a risk, not a fact. */
  const counts = useMemo(
    () => countCoverage(days, bars.filter((b) => !b.pending), holidays),
    [days, bars, holidays],
  );
  const peak = useMemo(() => peakCoverage(days, counts), [days, counts]);

  /**
   * "Jashtë sot" is a fact about today, but chips are only fetched for the
   * six-week grid — on a January page a count of 0 for an August today would
   * be a lie, so outside the window the strip says "—" instead.
   */
  const offOn = (iso: string): string => {
    const first = gridDays[0]?.iso ?? "";
    const last = gridDays[gridDays.length - 1]?.iso ?? "";
    if (iso < first || iso > last) return "—";
    const seen = new Set<string>();
    for (const b of bars) {
      if (!b.pending && b.startIso <= iso && iso <= b.endIso) seen.add(b.employeeId);
    }
    return String(seen.size);
  };
  const tomorrowIso = useMemo(() => {
    const t = new Date(`${props.todayIso}T00:00:00.000Z`);
    return new Date(t.getTime() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  }, [props.todayIso]);

  /** Every department present in the roster, plus the unassigned bucket. */
  const departmentOptions = useMemo(() => {
    const seen = new Map<string, string>();
    for (const e of props.employees) {
      const key = e.departmentName ?? NO_DEPARTMENT;
      if (!seen.has(key)) seen.set(key, e.departmentName ?? "Pa departament");
    }
    return [...seen.entries()].sort((a, b) => a[1].localeCompare(b[1], "sq-AL"));
  }, [props.employees]);

  const visibleEmployees = useMemo(() => {
    return props.employees.filter((e) => {
      // matchesQuery folds ë and ç, so "Recica" finds "Reçica" — the plain
      // lowercase compare this used could not.
      if (!matchesQuery(search, e.name, e.jobTitle)) return false;
      if (department && (e.departmentName ?? NO_DEPARTMENT) !== department) return false;
      if (who === "away") {
        const list = barsByEmployee.get(e.id) ?? [];
        if (!list.some((b) => clampBar(b, days) !== null)) return false;
      }
      return true;
    });
  }, [props.employees, search, department, who, barsByEmployee, days]);

  const filtered = visibleEmployees.length !== props.employees.length;

  const monthLabel = new Date(Date.UTC(props.year, props.month - 1, 1)).toLocaleDateString("sq-AL", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });

  const cols = `${NAME_COL} repeat(${days.length}, minmax(26px, 1fr))`;

  const dayCellTint = (d: WallchartDay): string => {
    if (holidays.has(d.iso)) return "bg-[#fffbeb]";
    if (d.isWeekend) return "bg-[#fbfcfe]";
    return "";
  };

  const peakLabel = peak
    ? `${peak.count} · ${new Date(`${peak.iso}T00:00:00.000Z`).getUTCDate()} ${new Date(
        `${peak.iso}T00:00:00.000Z`,
      ).toLocaleDateString("sq-AL", { month: "long", timeZone: "UTC" })}`
    : "—";

  let lastDept: string | null | undefined;

  return (
    <div className={`overflow-hidden ${LEAVE_CARD}`}>
      {/* header — period stepper + cover strip */}
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 border-b border-[#eef2f7] px-4 py-3">
        <div className="flex items-center gap-2">
          <Link href={props.prevHref} prefetch={false} aria-label="Muaji paraprak" className={NAV_BTN}>
            <ChevronLeft className="h-4 w-4" aria-hidden />
          </Link>
          <h2 className="min-w-[128px] text-center text-[13.5px] font-bold capitalize tracking-[-0.01em] text-[#0f172a]">
            {monthLabel}
          </h2>
          <Link href={props.nextHref} prefetch={false} aria-label="Muaji tjetër" className={NAV_BTN}>
            <ChevronRight className="h-4 w-4" aria-hidden />
          </Link>
          <Link
            href={props.todayHref}
            prefetch={false}
            className="ml-1 inline-flex h-8 items-center rounded-lg border border-[#e2e8f0] bg-white px-3 text-[12px] font-semibold text-[#334155] transition-colors hover:bg-[#eef2f7]"
          >
            Sot
          </Link>
        </div>
        <dl className="flex items-stretch divide-x divide-[#eef2f7]">
          <div className="px-4 first:pl-0">
            <dt className="text-[10.5px] font-bold uppercase tracking-[0.05em] text-[#94a3b8]">Jashtë sot</dt>
            <dd className="mt-0.5 text-[19px] font-extrabold leading-none tabular-nums tracking-[-0.02em] text-[#0f172a]">
              {offOn(props.todayIso)}
              {offOn(props.todayIso) !== "—" ? (
                <span className="text-[12px] font-semibold text-[#94a3b8]"> nga {props.employees.length}</span>
              ) : null}
            </dd>
          </div>
          <div className="px-4">
            <dt className="text-[10.5px] font-bold uppercase tracking-[0.05em] text-[#94a3b8]">Nesër</dt>
            <dd className="mt-0.5 text-[19px] font-extrabold leading-none tabular-nums tracking-[-0.02em] text-[#0f172a]">
              {offOn(tomorrowIso)}
            </dd>
          </div>
          <div className="px-4 last:pr-0">
            <dt className="text-[10.5px] font-bold uppercase tracking-[0.05em] text-[#94a3b8]">
              Kulmi (i miratuar)
            </dt>
            <dd className="mt-0.5 text-[19px] font-extrabold leading-none tabular-nums tracking-[-0.02em] text-[#b45309]">
              {peakLabel}
            </dd>
          </div>
        </dl>
      </div>

      {/* view controls — dept/type/status narrowing lives in the page filter form above */}
      <div className="flex flex-wrap items-center gap-2 border-b border-[#eef2f7] bg-[#fcfdff] px-4 py-2.5">
        <div
          className="inline-flex overflow-hidden rounded-lg border border-[#e2e8f0]"
          role="group"
          aria-label="Gjatësia e pamjes"
        >
          <button
            type="button"
            aria-pressed={view === "month"}
            onClick={() => setView("month")}
            className={`${SEG_BTN} ${view === "month" ? "bg-brand-blue text-white" : "bg-white text-[#64748b] hover:bg-[#f8fafc]"}`}
          >
            Muaji
          </button>
          <button
            type="button"
            aria-pressed={view === "sixWeeks"}
            onClick={() => setView("sixWeeks")}
            className={`${SEG_BTN} ${view === "sixWeeks" ? "bg-brand-blue text-white" : "bg-white text-[#64748b] hover:bg-[#f8fafc]"}`}
          >
            6 javë
          </button>
        </div>
        <div
          className="inline-flex overflow-hidden rounded-lg border border-[#e2e8f0]"
          role="group"
          aria-label="Kush shfaqet"
        >
          <button
            type="button"
            aria-pressed={who === "all"}
            onClick={() => setWho("all")}
            className={`${SEG_BTN} ${who === "all" ? "bg-brand-blue text-white" : "bg-white text-[#64748b] hover:bg-[#f8fafc]"}`}
          >
            Të gjithë
          </button>
          <button
            type="button"
            aria-pressed={who === "away"}
            onClick={() => setWho("away")}
            className={`${SEG_BTN} ${who === "away" ? "bg-brand-blue text-white" : "bg-white text-[#64748b] hover:bg-[#f8fafc]"}`}
          >
            Vetëm me pushim
          </button>
        </div>
        <span className="min-w-0 flex-1" />
        {filtered ? (
          <span className="text-[11.5px] tabular-nums text-[#64748b]">
            {visibleEmployees.length} nga {props.employees.length}
          </span>
        ) : null}
        {departmentOptions.length > 1 ? (
          <select
            value={department}
            onChange={(e) => setDepartment(e.target.value)}
            aria-label="Filtro sipas departamentit"
            className="h-[30px] rounded-lg border border-[#e2e8f0] bg-white px-2 text-[12.5px] text-[#334155] focus:outline-none focus:ring-2 focus:ring-brand-blue/30"
          >
            <option value="">Të gjitha departamentet</option>
            {departmentOptions.map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        ) : null}
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Kërko punonjës…"
          aria-label="Kërko punonjës"
          className="h-[30px] min-w-[190px] rounded-lg border border-[#e2e8f0] bg-white px-2.5 text-[12.5px] text-[#334155] placeholder:text-[#94a3b8] focus:outline-none focus:ring-2 focus:ring-brand-blue/30"
        />
      </div>

      {/* The chart scrolls in both directions inside its own box. The day header
          and the coverage strip are sticky to the top of THIS container, and the
          name column is sticky to its left, so neither the date you are reading
          nor the person you are reading about can scroll out of view. */}
      <div className={`${CHART_VIEWPORT} overflow-auto overscroll-contain`}>
        <div className="min-w-[940px]">
          {/* day header */}
          <div
            className="sticky top-0 z-[5] grid h-10 border-b border-[#eef2f7] bg-white"
            style={{ gridTemplateColumns: cols }}
          >
            <div className="sticky left-0 z-[3] flex items-center border-r border-[#eef2f7] bg-white px-3">
              <span className="text-[10.5px] font-bold uppercase tracking-[0.05em] text-[#94a3b8]">
                Punonjësi
              </span>
            </div>
            {days.map((d) => (
              <div
                key={d.iso}
                className={`pt-1.5 text-center text-[10px] leading-tight text-[#94a3b8] ${dayCellTint(d)} ${
                  d.iso === props.todayIso ? "shadow-[inset_2px_0_0_#2563EB]" : ""
                }`}
                title={holidays.has(d.iso) ? "Festë publike" : undefined}
              >
                {WEEKDAYS[d.weekday]}
                <b
                  className={`block text-[11.5px] font-semibold tabular-nums ${
                    d.inMonth ? "text-[#475569]" : "text-[#cbd5e1]"
                  }`}
                >
                  {d.dayOfMonth}
                </b>
              </div>
            ))}
          </div>

          {/* coverage row — approved only, blank on weekends and holidays */}
          <div
            className="sticky top-10 z-[5] grid h-[26px] border-b border-[#eef2f7] bg-[#fcfdff]"
            style={{ gridTemplateColumns: cols }}
          >
            <div className="sticky left-0 z-[3] flex items-center border-r border-[#eef2f7] bg-[#fcfdff] px-3">
              <span className="text-[10.5px] font-bold uppercase tracking-[0.05em] text-[#94a3b8]">
                Jashtë / ditë
              </span>
            </div>
            {days.map((d, i) => {
              const n = counts[i] ?? 0;
              const isPeak = peak !== null && n === peak.count && n > 0;
              return (
                <div
                  key={d.iso}
                  className={`flex items-center justify-center text-[10.5px] font-semibold tabular-nums ${
                    isPeak
                      ? "bg-[#fde8e8] text-[#dc2626]"
                      : n >= 2
                        ? "bg-[#fffbeb] text-[#b45309]"
                        : `text-[#94a3b8] ${dayCellTint(d)}`
                  }`}
                >
                  {n || ""}
                </div>
              );
            })}
          </div>

          {/* rows, grouped by department */}
          {visibleEmployees.length === 0 ? (
            <p className="px-4 py-10 text-center text-[13px] text-[#64748b]">
              {props.employees.length === 0
                ? "Ende pa punonjës aktivë — regjistroni punonjës që kalendari i ekipit të marrë kuptim."
                : "Asnjë punonjës nuk përputhet me kërkimin ose filtrat."}
            </p>
          ) : (
            visibleEmployees.map((emp) => {
              const deptHeader =
                emp.departmentName !== lastDept ? (
                  <div
                    key={`dept-${emp.departmentName ?? "none"}`}
                    className="grid h-[26px] border-b border-[#f1f5f9] bg-[#f8fafc]"
                    style={{ gridTemplateColumns: cols }}
                  >
                    <div className="sticky left-0 z-[3] flex items-center border-r border-[#eef2f7] bg-[#f8fafc] px-3 text-[10.5px] font-bold uppercase tracking-[0.05em] text-[#64748b]">
                      {emp.departmentName ?? "Pa departament"}
                    </div>
                    {days.map((d) => (
                      <div key={d.iso} className={dayCellTint(d)} />
                    ))}
                  </div>
                ) : null;
              lastDept = emp.departmentName;

              const laned = assignLanes(
                (barsByEmployee.get(emp.id) ?? []).filter((b) => clampBar(b, days) !== null),
              );
              const laneCount = laned.length === 0 ? 1 : Math.max(...laned.map((l) => l.lane)) + 1;
              const rowHeight = Math.max(36, laneCount * LANE_PX + 12);

              return (
                <div key={emp.id}>
                  {deptHeader}
                  <div
                    className="group/row grid border-b border-[#f6f8fb] hover:bg-[#fbfcfe]"
                    style={{
                      gridTemplateColumns: cols,
                      gridTemplateRows: `repeat(${laneCount}, ${LANE_PX}px)`,
                      height: rowHeight,
                      alignContent: "center",
                    }}
                  >
                    <div
                      className="sticky left-0 z-[3] flex items-center gap-2.5 border-r border-[#eef2f7] bg-white px-3 group-hover/row:bg-[#fbfcfe]"
                      style={{ gridRow: "1 / -1" }}
                    >
                      <span className="grid h-[26px] w-[26px] flex-none place-items-center rounded-full bg-[#e8eefb] text-[10.5px] font-bold text-[#1e40af]">
                        {initials(emp.name)}
                      </span>
                      <span className="min-w-0">
                        <Link
                          href={`/punonjesit/${emp.id}`}
                          className="block truncate text-[12.5px] font-semibold text-[#0f172a] hover:underline"
                        >
                          {emp.name}
                        </Link>
                        {emp.jobTitle ? (
                          <span className="block truncate text-[10.5px] text-[#94a3b8]">{emp.jobTitle}</span>
                        ) : null}
                      </span>
                    </div>
                    {days.map((d, i) => (
                      <div
                        key={d.iso}
                        className={`${dayCellTint(d)} ${
                          d.iso === props.todayIso ? "shadow-[inset_2px_0_0_#2563EB]" : ""
                        }`}
                        style={{ gridRow: "1 / -1", gridColumn: `${i + 2}` }}
                      />
                    ))}
                    {laned.map(({ bar, lane }) => {
                      const placed = clampBar(bar, days);
                      if (!placed) return null;
                      const tone = LEAVE_TYPE_TONES[bar.type];
                      const label = `${LEAVE_TYPE_LABELS_SQ[bar.type]}${
                        bar.workingDays ? ` · ${bar.workingDays} ditë` : ""
                      }${bar.pending ? " · në pritje" : ""}`;
                      return (
                        <Link
                          key={bar.id}
                          href={`/pushimet/${bar.id}`}
                          title={`${bar.employeeName} · ${label} · ${rangeSq(bar.startIso, bar.endIso)}`}
                          aria-label={`${bar.employeeName}: ${label}, ${rangeSq(bar.startIso, bar.endIso)}`}
                          className={`z-[2] mx-[2px] flex h-[21px] items-center self-center truncate rounded-[5px] border px-1.5 text-[10.5px] font-semibold leading-none transition-opacity hover:opacity-80 ${tone.text} ${
                            bar.pending ? "border-dashed border-[#f59e0b] bg-white" : `${tone.border} ${tone.bg}`
                          }`}
                          style={{
                            gridRow: lane + 1,
                            gridColumn: `${placed.col + 2} / span ${placed.span}`,
                          }}
                        >
                          {placed.span >= 3 ? label : ""}
                        </Link>
                      );
                    })}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* legend */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-[#eef2f7] px-4 py-2.5 text-[11px] font-medium text-[#64748b]">
        {LEGEND_TYPES.map((t) => (
          <span key={t} className="inline-flex items-center gap-1.5">
            <span className={`h-2 w-2 rounded-full ${LEAVE_TYPE_TONES[t].dot}`} aria-hidden />
            {LEAVE_TYPE_LABELS_SQ[t]}
          </span>
        ))}
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-[3px] border border-dashed border-[#f59e0b] bg-white" aria-hidden />
          Në pritje
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-[3px] bg-[#fffbeb]" aria-hidden />
          Festë publike
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-[3px] bg-[#fbfcfe] ring-1 ring-inset ring-[#e2e8f0]" aria-hidden />
          Vikend
        </span>
      </div>
    </div>
  );
}
