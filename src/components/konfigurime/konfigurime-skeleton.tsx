import { Skeleton } from "@/components/ui/skeleton";

/** Reserve layout for Suspense / loading states once settings fetch exists */
export function KonfigurimePageSkeleton() {
  return (
    <div className="space-y-8 pb-4">
      <div className="flex flex-col gap-4 border-b border-border pb-6 md:flex-row md:items-start md:justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-full max-w-xl" />
        </div>
        <Skeleton className="h-9 w-28 shrink-0" />
      </div>
      <Skeleton className="h-[4.5rem] w-full max-w-3xl rounded-lg" />
      <div className="flex gap-2 overflow-hidden">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-28 shrink-0 rounded-md" />
        ))}
      </div>
      <Skeleton className="h-[28rem] w-full rounded-lg" />
    </div>
  );
}
