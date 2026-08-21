"use client";

import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type {
  LeaveMonthPoint,
  PayrollCostPoint,
  WorkforceMovementPoint,
  WorkforceSlice,
} from "@/modules/reports/services/report-analytics-service";

/**
 * Every chart on `/raportet`. This is the ONLY module that imports recharts —
 * `raportet-charts-client.tsx` pulls it in through `next/dynamic` with
 * `ssr: false`, which keeps the library out of the server bundle.
 *
 * Recharts' default palette is not the brand's, so each series names its colour
 * from the 1b tokens rather than letting the library choose.
 */

export const CHART = {
  navy: "#0B1220",
  blue: "#2563EB",
  blueSoft: "#93C5FD",
  green: "#16A34A",
  amber: "#D97706",
  red: "#DC2626",
  slate: "#94A3B8",
  grid: "#EEF2F7",
  axis: "#94A3B8",
} as const;

const AXIS_TICK = { fontSize: 11, fill: CHART.axis } as const;
const GRID = { stroke: CHART.grid, strokeDasharray: "0" } as const;

const eur = (v: number): string =>
  `€${v.toLocaleString("de-DE", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

const TOOLTIP_STYLE = {
  contentStyle: {
    borderRadius: 10,
    border: "1px solid #e2e8f0",
    boxShadow: "0 4px 12px rgba(15,23,42,0.08)",
    fontSize: 12,
  },
  labelStyle: { fontWeight: 700, color: CHART.navy, marginBottom: 4 },
} as const;

const LEGEND_STYLE = { fontSize: 11.5, paddingTop: 6 } as const;

/** Payroll cost per month: bruto / neto grouped, employer total cost as a line. */
export function PayrollCostChart({ data }: { data: PayrollCostPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <ComposedChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid {...GRID} vertical={false} />
        <XAxis dataKey="label" tick={AXIS_TICK} tickLine={false} axisLine={{ stroke: CHART.grid }} />
        <YAxis
          tick={AXIS_TICK}
          tickLine={false}
          axisLine={false}
          width={64}
          tickFormatter={(v: number) => eur(v)}
        />
        <Tooltip {...TOOLTIP_STYLE} formatter={(v) => eur(Number(v))} />
        <Legend wrapperStyle={LEGEND_STYLE} />
        <Bar dataKey="gross" name="Bruto" fill={CHART.blue} radius={[3, 3, 0, 0]} maxBarSize={22} />
        <Bar dataKey="net" name="Neto" fill={CHART.blueSoft} radius={[3, 3, 0, 0]} maxBarSize={22} />
        {/* Area, not Line: the soft fill under the cost curve is the fintech
            signature — the eye reads accumulated cost, not just a trajectory. */}
        <Area
          type="monotone"
          dataKey="employerCost"
          name="Kosto totale e punëdhënësit"
          stroke={CHART.navy}
          strokeWidth={2}
          fill="rgba(37, 99, 235, 0.08)"
          dot={{ r: 3, fill: CHART.navy }}
          activeDot={{ r: 4 }}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

/** Headcount per department — horizontal so long Albanian names stay readable. */
export function DepartmentChart({ data }: { data: WorkforceSlice[] }) {
  return (
    <ResponsiveContainer width="100%" height={Math.max(160, data.length * 34 + 30)}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 24, left: 0, bottom: 0 }}>
        <CartesianGrid {...GRID} horizontal={false} />
        <XAxis type="number" tick={AXIS_TICK} tickLine={false} axisLine={false} allowDecimals={false} />
        <YAxis
          type="category"
          dataKey="label"
          tick={AXIS_TICK}
          tickLine={false}
          axisLine={false}
          width={128}
        />
        <Tooltip {...TOOLTIP_STYLE} formatter={(v) => `${v} punonjës`} />
        <Bar dataKey="count" name="Punonjës" fill={CHART.blue} radius={[0, 3, 3, 0]} maxBarSize={20} />
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Joiners up, leavers down, net as a line across it. */
export function MovementChart({ data }: { data: WorkforceMovementPoint[] }) {
  const plotted = data.map((d) => ({ ...d, leaversNeg: -d.leavers }));
  return (
    <ResponsiveContainer width="100%" height={260}>
      <ComposedChart data={plotted} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid {...GRID} vertical={false} />
        <XAxis dataKey="label" tick={AXIS_TICK} tickLine={false} axisLine={{ stroke: CHART.grid }} />
        <YAxis
          tick={AXIS_TICK}
          tickLine={false}
          axisLine={false}
          width={36}
          allowDecimals={false}
          tickFormatter={(v: number) => String(Math.abs(v))}
        />
        <Tooltip
          {...TOOLTIP_STYLE}
          formatter={(v, name) => [String(Math.abs(Number(v))), String(name)]}
        />
        <Legend wrapperStyle={LEGEND_STYLE} />
        <Bar dataKey="joiners" name="Punësime" fill={CHART.green} radius={[3, 3, 0, 0]} maxBarSize={20} />
        <Bar dataKey="leaversNeg" name="Largime" fill={CHART.red} radius={[0, 0, 3, 3]} maxBarSize={20} />
        <Line
          type="monotone"
          dataKey="net"
          name="Ndryshimi neto"
          stroke={CHART.navy}
          strokeWidth={2}
          dot={{ r: 3, fill: CHART.navy }}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

/** Approved leave days by month — the concentration a manager plans around. */
export function LeaveByMonthChart({ data }: { data: LeaveMonthPoint[] }) {
  const peak = data.reduce((max, d) => Math.max(max, d.days), 0);
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid {...GRID} vertical={false} />
        <XAxis dataKey="label" tick={AXIS_TICK} tickLine={false} axisLine={{ stroke: CHART.grid }} />
        <YAxis tick={AXIS_TICK} tickLine={false} axisLine={false} width={40} allowDecimals={false} />
        <Tooltip {...TOOLTIP_STYLE} formatter={(v) => `${v} ditë pune`} />
        <Bar dataKey="days" name="Ditë pushimi" radius={[3, 3, 0, 0]} maxBarSize={26}>
          {data.map((d) => (
            // The busiest month is the point of the chart; colour says so.
            <Cell key={d.key} fill={peak > 0 && d.days === peak ? CHART.amber : CHART.blue} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
