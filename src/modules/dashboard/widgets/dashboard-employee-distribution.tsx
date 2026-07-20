import {
  EMPLOYMENT_STATUS_LABELS,
  EMPLOYMENT_TYPE_LABELS,
} from "@/modules/employees/components/employees-labels";
import type { EmploymentStatus, EmploymentType } from "@prisma/client";
import type { EmployeeDistributionSlice } from "../types/dashboard-types";

/** Segment palette from the 1b handoff — navy, accent, then slate steps. */
const SEGMENT_COLORS = ["#0B1220", "#2563EB", "#64748b", "#94a3b8", "#cbd5e1", "#e2e8f0"];

export function DashboardEmployeeDistribution({
  distribution,
}: {
  distribution: EmployeeDistributionSlice;
}) {
  const statusEntries = (Object.entries(distribution.byStatus) as [EmploymentStatus, number][]).filter(
    ([, n]) => n > 0,
  );
  const typeEntries = (
    Object.entries(distribution.byEmploymentType) as [EmploymentType, number][]
  ).filter(([, n]) => n > 0);
  const total = distribution.byDepartment.reduce((sum, d) => sum + d.count, 0);

  const largestDepartment = Math.max(...distribution.byDepartment.map((d) => d.count), 1);

  return (
    <section className="rounded-lg border border-[#e2e8f0] bg-white p-5 shadow-[0_1px_3px_rgba(15,23,42,0.05)]">
      <h3 className="text-[14.5px] font-bold text-[#0f172a]">
        Fuqia punëtore · <span className="tabular-nums">{total}</span>
      </h3>
      <p className="mt-0.5 text-[12px] text-[#94a3b8]">Sipas departamentit, statusit dhe llojit</p>

      {distribution.byDepartment.length === 0 ? (
        <p className="mt-4 text-sm text-[#64748b]">Nuk ka departamente.</p>
      ) : (
        <ul className="mt-4 space-y-3" aria-label="Punonjësit sipas departamentit">
          {distribution.byDepartment.map((d, i) => (
            <li
              key={d.departmentId ?? "none"}
              className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1.5 text-[12.5px] sm:grid-cols-[minmax(120px,180px)_minmax(0,1fr)_32px]"
            >
              <span className="flex min-w-0 items-center gap-2 font-medium text-[#334155]">
                <span
                  className="h-[9px] w-[9px] flex-none rounded-[3px]"
                  style={{ background: SEGMENT_COLORS[i % SEGMENT_COLORS.length] }}
                  aria-hidden
                />
                <span className="truncate">{d.departmentName}</span>
              </span>
              <div
                className="col-span-2 h-2 overflow-hidden rounded bg-[#f1f5f9] sm:col-span-1"
                role="img"
                aria-label={`${d.departmentName}: ${d.count} nga ${total} punonjës`}
              >
                <div
                  className="h-full rounded"
                  style={{
                    width: `${(d.count / largestDepartment) * 100}%`,
                    background: SEGMENT_COLORS[i % SEGMENT_COLORS.length],
                  }}
                />
              </div>
              <span className="row-start-1 text-right font-bold tabular-nums text-[#0f172a] sm:col-start-3">
                {d.count}
              </span>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-4 grid grid-cols-1 gap-4 border-t border-[#f1f5f9] pt-4 sm:grid-cols-2">
        <div>
          <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.05em] text-[#94a3b8]">
            Statusi
          </p>
          {statusEntries.length === 0 ? (
            <p className="text-[12.5px] text-[#64748b]">Nuk ka të dhëna.</p>
          ) : (
            <ul className="space-y-1.5">
              {statusEntries.map(([k, n]) => (
                <li key={k} className="flex items-center justify-between gap-3 text-[12.5px]">
                  <span className="text-[#334155]">{EMPLOYMENT_STATUS_LABELS[k]}</span>
                  <span className="font-bold tabular-nums text-[#0f172a]">{n}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div>
          <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.05em] text-[#94a3b8]">
            Lloji i punësimit
          </p>
          {typeEntries.length === 0 ? (
            <p className="text-[12.5px] text-[#64748b]">Nuk ka të dhëna.</p>
          ) : (
            <ul className="space-y-1.5">
              {typeEntries.map(([k, n]) => (
                <li key={k} className="flex items-center justify-between gap-3 text-[12.5px]">
                  <span className="text-[#334155]">{EMPLOYMENT_TYPE_LABELS[k]}</span>
                  <span className="font-bold tabular-nums text-[#0f172a]">{n}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}
