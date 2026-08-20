import { Skeleton } from "@/components/ui/skeleton";
import { ChartSkeleton } from "@/components/patterns/chart-frame";
import { DashboardFiltersBarSkeleton } from "@/modules/dashboard/widgets/dashboard-filters-bar";
import { DashboardPayrollPanelSkeleton } from "@/modules/dashboard/widgets/dashboard-payroll-panel";
import { DashboardKpiCardsSkeleton } from "@/modules/dashboard/widgets/dashboard-summary-cards";

function QueueRowSkeleton() {
  return (
    <div className="flex items-center gap-[15px] rounded-xl border border-line border-l-[3px] border-l-[#e2e8f0] bg-white px-[18px] py-4">
      <Skeleton className="h-[38px] w-[38px] rounded-[10px]" />
      <div className="min-w-0 flex-1 space-y-2">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-1/2" />
      </div>
      <Skeleton className="h-9 w-24 rounded-[9px]" />
    </div>
  );
}

function CardSkeleton({ lines = 4 }: { lines?: number }) {
  return (
    <div className="overflow-hidden rounded-xl border border-line bg-white">
      <div className="border-b border-fill px-[18px] py-3">
        <Skeleton className="h-4 w-36" />
      </div>
      <div className="divide-y divide-fill">
        {Array.from({ length: lines }).map((_, i) => (
          <div key={i} className="px-[18px] py-2.5">
            <Skeleton className="mb-1.5 h-3.5 w-2/3" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        ))}
      </div>
    </div>
  );
}

/** Mirrors the five bands of the real page so nothing shifts when data lands. */
export default function PaneliLoading() {
  return (
    <>
      <div className="-mx-4 -mt-4 mb-6 border-b border-line bg-white px-4 py-[22px] md:-mx-10 md:-mt-6 md:px-10">
        <Skeleton className="mb-1.5 h-3 w-44" />
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between sm:gap-6">
          <Skeleton className="h-8 w-56" />
          <div className="flex flex-wrap items-center gap-2.5">
            <DashboardFiltersBarSkeleton />
            <Skeleton className="h-10 w-32 rounded-[10px]" />
            <Skeleton className="h-10 w-40 rounded-[10px]" />
          </div>
        </div>
      </div>

      <div className="space-y-7 pb-24 md:pb-8">
        {/* 1 — run + KPIs */}
        <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,360px)]">
          <DashboardPayrollPanelSkeleton />
          <DashboardKpiCardsSkeleton />
        </div>

        {/* 2 — action queue */}
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

        {/* 3 + 4 — trend + today */}
        <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,340px)]">
          <div>
            <Skeleton className="mb-3 h-5 w-56" />
            <div className="rounded-xl border border-line bg-white p-4">
              <ChartSkeleton height={280} />
            </div>
          </div>
          <div className="space-y-4">
            <CardSkeleton lines={3} />
            <CardSkeleton lines={1} />
          </div>
        </div>

        {/* 5 — workforce */}
        <div className="space-y-4">
          <Skeleton className="h-5 w-36" />
          <div className="grid gap-4 xl:grid-cols-2">
            <div className="rounded-xl border border-line bg-white p-4">
              <ChartSkeleton height={200} />
            </div>
            <div className="rounded-xl border border-line bg-white p-4">
              <ChartSkeleton height={260} />
            </div>
          </div>
        </div>

        <CardSkeleton lines={6} />
      </div>
    </>
  );
}
