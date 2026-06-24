import { Skeleton } from "@/components/ui/skeleton";

export default function EmployeeProfileLoading() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-10 w-40" />
      <Skeleton className="h-10 w-64" />
      <Skeleton className="h-12 w-full max-w-xl" />
      <div className="grid gap-4 lg:grid-cols-2">
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    </div>
  );
}
