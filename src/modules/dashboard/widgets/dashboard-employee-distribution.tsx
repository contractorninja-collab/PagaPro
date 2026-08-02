"use client";

import dynamic from "next/dynamic";
import type { EmploymentStatus, EmploymentType } from "@prisma/client";
import { ChartFrame, ChartSkeleton } from "@/components/patterns/chart-frame";
import {
  EMPLOYMENT_STATUS_LABELS,
  EMPLOYMENT_TYPE_LABELS,
} from "@/modules/employees/components/employees-labels";
import type { EmployeeDistributionSlice, WorkforceMovementPointDto } from "../types/dashboard-types";

/**
 * Who the workforce is, and how it moved.
 *
 * The department bars used to be normalised to the *largest department*, so a
 * full-width bar meant "biggest team" rather than "most of the company" — a
 * chart that answered a question nobody asked. Real counts against a real axis
 * fix that, and the joiners/leavers series (already computed for Raportet, never
 * shown here) gives the headcount figure in the KPI row its context.
 */

const DepartmentChart = dynamic(
  () => import("@/modules/reports/components/charts/report-charts").then((m) => m.DepartmentChart),
  { ssr: false, loading: () => <ChartSkeleton height={200} /> },
);
const MovementChart = dynamic(
  () => import("@/modules/reports/components/charts/report-charts").then((m) => m.MovementChart),
  { ssr: false, loading: () => <ChartSkeleton height={260} /> },
);

const EMPTY_CARD =
  "rounded-xl border border-[#e2e8f0] bg-white px-4 py-10 text-center shadow-[0_1px_3px_rgba(15,23,42,0.05)]";

function MiniList({ title, rows }: { title: string; rows: Array<{ label: string; count: number }> }) {
  if (rows.length === 0) return null;
  return (
    <div>
      <h4 className="text-[11px] font-bold uppercase tracking-[0.04em] text-[#94a3b8]">{title}</h4>
      <dl className="mt-2 space-y-1.5">
        {rows.map((r) => (
          <div key={r.label} className="flex items-baseline justify-between gap-3">
            <dt className="truncate text-[12.5px] text-[#334155]">{r.label}</dt>
            <dd className="text-[13px] font-semibold tabular-nums text-[#0f172a]">{r.count}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

export function DashboardEmployeeDistribution({
  distribution,
  movement,
  year,
}: {
  distribution: EmployeeDistributionSlice;
  movement: WorkforceMovementPointDto[];
  year: number;
}) {
  const departmentData = distribution.byDepartment.map((d) => ({
    key: d.departmentId ?? "none",
    label: d.departmentName,
    count: d.count,
  }));
  const total = departmentData.reduce((sum, d) => sum + d.count, 0);

  const statusRows = (Object.entries(distribution.byStatus) as [EmploymentStatus, number][])
    .filter(([, n]) => n > 0)
    .map(([key, count]) => ({ label: EMPLOYMENT_STATUS_LABELS[key] ?? key, count }));
  const typeRows = (Object.entries(distribution.byEmploymentType) as [EmploymentType, number][])
    .filter(([, n]) => n > 0)
    .map(([key, count]) => ({ label: EMPLOYMENT_TYPE_LABELS[key] ?? key, count }));

  const joiners = movement.reduce((s, m) => s + m.joiners, 0);
  const leavers = movement.reduce((s, m) => s + m.leavers, 0);
  const hasMovement = joiners > 0 || leavers > 0;
  const net = joiners - leavers;

  return (
    <section className="space-y-4">
      <h3 className="text-[15px] font-bold text-[#0f172a]">Fuqia punëtore</h3>

      <div className="grid gap-4 xl:grid-cols-2">
        {departmentData.length > 0 ? (
          <ChartFrame
            summary={`Punonjësit sipas departamentit, gjithsej ${total}.`}
            fallback={departmentData.map((d) => `${d.label}: ${d.count}`).join(" · ")}
          >
            <DepartmentChart data={departmentData} />
          </ChartFrame>
        ) : (
          <div className={EMPTY_CARD}>
            <p className="text-[13px] text-[#64748b]">Ende asnjë punonjës i regjistruar.</p>
          </div>
        )}

        {hasMovement ? (
          <ChartFrame
            summary={`Punësime dhe largime sipas muajit për ${year}.`}
            fallback={`Gjatë ${year}: ${joiners} punësime dhe ${leavers} largime — bilanc ${net >= 0 ? "+" : ""}${net}.`}
          >
            <MovementChart data={movement} />
          </ChartFrame>
        ) : (
          <div className={EMPTY_CARD}>
            <p className="text-[13px] text-[#64748b]">
              Pa punësime apo largime të regjistruara në {year}.
            </p>
          </div>
        )}
      </div>

      <div className="grid gap-x-8 gap-y-4 rounded-xl border border-[#e2e8f0] bg-white px-[18px] py-4 shadow-[0_1px_3px_rgba(15,23,42,0.05)] sm:grid-cols-2">
        <MiniList title="Sipas statusit" rows={statusRows} />
        <MiniList title="Sipas llojit të punësimit" rows={typeRows} />
      </div>
    </section>
  );
}
