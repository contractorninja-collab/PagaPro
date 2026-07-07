import { Skeleton } from "@/components/ui/skeleton";
import { DashboardAlertsPanelSkeleton } from "@/modules/dashboard/widgets/dashboard-alerts-panel";
import { DashboardPayrollPanelSkeleton } from "@/modules/dashboard/widgets/dashboard-payroll-panel";
import { DashboardFiltersBarSkeleton } from "@/modules/dashboard/widgets/dashboard-filters-bar";
import { DashboardKpiCardsSkeleton } from "@/modules/dashboard/widgets/dashboard-summary-cards";

export default function PaneliLoading() {
  return (
    <div className="dashboard-container pb-24 md:pb-8">
      <div className="mb-6 space-y-6">
        <div className="page-header space-y-2 border-b border-border">
          <Skeleton className="h-8 w-52 max-w-full" />
          <Skeleton className="h-4 w-full max-w-xl" />
          <Skeleton className="h-9 w-36 rounded-md" />
        </div>
        <DashboardFiltersBarSkeleton />
      </div>

      <div className="dashboard-main-grid mb-5">
        <DashboardPayrollPanelSkeleton />
        <DashboardAlertsPanelSkeleton />
      </div>

      <div className="dashboard-grid">
        <DashboardKpiCardsSkeleton />
        <div className="card-half">
          <Skeleton className="surface-card h-64 w-full" />
        </div>
        <div className="card-half">
          <Skeleton className="surface-card h-64 w-full" />
        </div>
        <div className="card-half">
          <Skeleton className="surface-card h-64 w-full" />
        </div>
        <div className="card-half">
          <Skeleton className="surface-card h-64 w-full" />
        </div>
      </div>
    </div>
  );
}
