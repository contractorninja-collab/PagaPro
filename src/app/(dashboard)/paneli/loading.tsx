import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { DashboardSummaryCardsSkeleton } from "@/modules/dashboard/widgets/dashboard-summary-cards";

export default function PaneliLoading() {
  return (
    <div className="space-y-8 pb-24 md:pb-8">
      <div className="space-y-2">
        <Skeleton className="h-8 w-48 max-w-full" />
        <Skeleton className="h-4 w-full max-w-xl" />
      </div>
      <Skeleton className="h-[120px] w-full rounded-lg" />
      <Skeleton className="h-40 w-full rounded-lg" />
      <DashboardSummaryCardsSkeleton />
      <div className="grid gap-6 xl:grid-cols-2">
        <Card className="border-border/80 shadow-none">
          <CardHeader>
            <Skeleton className="h-5 w-36" />
            <Skeleton className="h-3 w-52" />
          </CardHeader>
          <CardContent className="space-y-3">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-9 w-full" />
          </CardContent>
        </Card>
        <Card className="border-border/80 shadow-none">
          <CardHeader>
            <Skeleton className="h-5 w-40" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-32 w-full" />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
