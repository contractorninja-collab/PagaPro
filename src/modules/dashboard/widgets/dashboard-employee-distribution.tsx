import { EMPLOYMENT_STATUS_LABELS, EMPLOYMENT_TYPE_LABELS } from "@/modules/employees/components/employees-labels";
import { PanelHeader } from "@/components/patterns/page-header";
import type { EmploymentStatus, EmploymentType } from "@prisma/client";
import type { EmployeeDistributionSlice } from "../types/dashboard-types";

export function DashboardEmployeeDistribution({ distribution }: { distribution: EmployeeDistributionSlice }) {
  const statusEntries = (Object.entries(distribution.byStatus) as [EmploymentStatus, number][]).filter(
    ([, n]) => n > 0,
  );
  const typeEntries = (Object.entries(distribution.byEmploymentType) as [EmploymentType, number][]).filter(
    ([, n]) => n > 0,
  );
  const maxDept = Math.max(...distribution.byDepartment.map((d) => d.count), 1);

  return (
    <div className="surface-card flex h-full flex-col">
      <PanelHeader
        title="Fuqia punëtore dhe departamentet"
        description="Shpërndarja sipas statusit, llojit dhe departamentit."
      />
      <div className="grid gap-6 surface-card-body lg:grid-cols-2">
        <div className="space-y-3">
          <p className="card-label">Statusi</p>
          {statusEntries.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nuk ka të dhëna.</p>
          ) : (
            <ul className="space-y-2">
              {statusEntries.map(([k, n]) => (
                <li key={k} className="flex items-center justify-between gap-3 text-sm">
                  <span>{EMPLOYMENT_STATUS_LABELS[k]}</span>
                  <span className="tabular-nums font-bold text-[#0f172a]">{n}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="space-y-3">
          <p className="card-label">Lloji i punësimit</p>
          {typeEntries.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nuk ka të dhëna.</p>
          ) : (
            <ul className="space-y-2">
              {typeEntries.map(([k, n]) => (
                <li key={k} className="flex items-center justify-between gap-3 text-sm">
                  <span>{EMPLOYMENT_TYPE_LABELS[k]}</span>
                  <span className="tabular-nums font-bold text-[#0f172a]">{n}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="space-y-3 lg:col-span-2">
          <p className="card-label">Departamentet</p>
          {distribution.byDepartment.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nuk ka departamente.</p>
          ) : (
            <ul className="space-y-3">
              {distribution.byDepartment.map((d) => (
                <li key={d.departmentId ?? "none"} className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="font-medium text-foreground">{d.departmentName}</span>
                    <span className="tabular-nums text-muted-foreground">{d.count}</span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded bg-muted">
                    <div
                      className="h-full bg-primary/70"
                      style={{ width: `${Math.round((d.count / maxDept) * 100)}%` }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
