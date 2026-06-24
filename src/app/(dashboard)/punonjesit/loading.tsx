import { Skeleton } from "@/components/ui/skeleton";

export default function PunonjesitLoading() {
  return (
    <div className="space-y-8">
      <div className="space-y-4 rounded-lg border border-border bg-card p-4">
        <Skeleton className="h-24 w-full" />
      </div>
      <div className="space-y-4 border-b border-border pb-6">
        <Skeleton className="h-9 w-48" />
        <Skeleton className="h-4 w-full max-w-xl" />
      </div>
      <Skeleton className="h-72 w-full" />
    </div>
  );
}
