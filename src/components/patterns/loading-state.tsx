import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export interface LoadingStateProps {
  /** Number of skeleton rows for table-style loading */
  rows?: number;
  className?: string;
}

/** Full-block placeholder — use inside Suspense boundaries or route loading.tsx */
export function LoadingState({ rows = 5, className }: LoadingStateProps) {
  return (
    <div className={cn("space-y-6 animate-fade-in", className)}>
      <div className="space-y-2">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-full max-w-md" />
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <Skeleton className="h-28 rounded-lg" />
        <Skeleton className="h-28 rounded-lg" />
        <Skeleton className="h-28 rounded-lg" />
      </div>
      <div className="rounded-lg border border-border">
        <div className="border-b border-border p-3">
          <Skeleton className="h-4 w-32" />
        </div>
        <div className="divide-y divide-border p-3 space-y-3">
          {Array.from({ length: rows }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      </div>
    </div>
  );
}
