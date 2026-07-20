import { Skeleton } from "@/components/ui/skeleton";
import { DashboardFiltersBarSkeleton } from "@/modules/dashboard/widgets/dashboard-filters-bar";
import { DashboardPayrollPanelSkeleton } from "@/modules/dashboard/widgets/dashboard-payroll-panel";
import { DashboardKpiCardsSkeleton } from "@/modules/dashboard/widgets/dashboard-summary-cards";

function QueueRowSkeleton() {
  return (
    <div className="flex items-center gap-[15px] rounded-xl border border-[#e2e8f0] border-l-[3px] border-l-[#e2e8f0] bg-white px-[18px] py-4">
      <Skeleton className="h-[38px] w-[38px] rounded-[10px]" />
      <div className="min-w-0 flex-1 space-y-2">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-1/2" />
      </div>
      <Skeleton className="h-9 w-24 rounded-[9px]" />
    </div>
  );
}

export default function PaneliLoading() {
  return (
    <>
      {/* Sub-bar */}
      <div className="-mx-4 -mt-4 mb-6 border-b border-[#e2e8f0] bg-white px-4 py-[22px] md:-mx-10 md:-mt-6 md:px-10">
        <Skeleton className="mb-1.5 h-3 w-44" />
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between sm:gap-6">
          <Skeleton className="h-8 w-56" />
          <div className="flex flex-wrap items-center gap-2.5">
            <DashboardFiltersBarSkeleton />
            <Skeleton className="h-10 w-40 rounded-[10px]" />
          </div>
        </div>
      </div>

      {/* Body — 1fr / 400px grid */}
      <div className="pb-24 md:pb-8">
        <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_400px]">
          <div className="min-w-0 space-y-[22px]">
            <div>
              <div className="mb-4 flex items-baseline justify-between">
                <Skeleton className="h-5 w-44" />
                <Skeleton className="h-3 w-36" />
              </div>
              <div className="flex flex-col gap-[11px]">
                {Array.from({ length: 4 }).map((_, i) => (
                  <QueueRowSkeleton key={i} />
                ))}
              </div>
            </div>
            <div className="rounded-[14px] border border-[#e2e8f0] bg-white px-[22px] py-5">
              <div className="flex items-start justify-between">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-6 w-28" />
              </div>
              <div className="mt-4 flex h-24 items-end gap-4">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="h-full max-w-[44px] flex-1 rounded-t-md" />
                ))}
              </div>
            </div>
            <div className="rounded-lg border border-[#e2e8f0] bg-white p-5">
              <Skeleton className="mb-2 h-4 w-40" />
              <Skeleton className="mb-5 h-3 w-64 max-w-full" />
              <div className="space-y-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="grid grid-cols-[150px_1fr_24px] items-center gap-3">
                    <Skeleton className="h-3 w-28" />
                    <Skeleton className="h-2 w-full" />
                    <Skeleton className="h-3 w-5" />
                  </div>
                ))}
              </div>
            </div>
            <div className="overflow-hidden rounded-lg border border-[#e2e8f0] bg-white">
              <div className="border-b border-[#f1f5f9] px-5 py-4">
                <Skeleton className="mb-2 h-4 w-36" />
                <Skeleton className="mb-3 h-3 w-64 max-w-full" />
                <Skeleton className="h-8 w-64 max-w-full rounded-md" />
              </div>
              <div className="divide-y divide-[#f1f5f9]">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="px-5 py-3">
                    <Skeleton className="mb-2 h-3.5 w-2/3" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="min-w-0 space-y-[18px]">
            <DashboardPayrollPanelSkeleton />
            <DashboardKpiCardsSkeleton />
          </div>
        </div>
      </div>
    </>
  );
}
