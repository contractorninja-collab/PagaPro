import { EMPLOYMENT_STATUS_LABELS, EMPLOYMENT_TYPE_LABELS } from "@/modules/employees/components/employees-labels";
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
    <div className="rounded-lg border border-border/80 bg-card">
      <div className="border-b border-border/60 px-4 py-3">
        <h2 className="text-sm font-semibold text-foreground">Shpërndarja e fuqisë punëtore</h2>
        <p className="text-xs text-muted-foreground">Numër sipas statusit, llojit dhe departamentit.</p>
      </div>
      <div className="grid gap-6 p-4 lg:grid-cols-2">
        <div className="space-y-3">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Statusi</p>
          {statusEntries.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nuk ka të dhëna.</p>
          ) : (
            <ul className="space-y-2">
              {statusEntries.map(([k, n]) => (
                <li key={k} className="flex items-center justify-between gap-3 text-sm">
                  <span>{EMPLOYMENT_STATUS_LABELS[k]}</span>
                  <span className="tabular-nums font-semibold">{n}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="space-y-3">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Lloji i punësimit</p>
          {typeEntries.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nuk ka të dhëna.</p>
          ) : (
            <ul className="space-y-2">
              {typeEntries.map(([k, n]) => (
                <li key={k} className="flex items-center justify-between gap-3 text-sm">
                  <span>{EMPLOYMENT_TYPE_LABELS[k]}</span>
                  <span className="tabular-nums font-semibold">{n}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="space-y-3 lg:col-span-2">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Departamentet</p>
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
