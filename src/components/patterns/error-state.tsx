import type { ReactNode } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface ErrorStateProps {
  title?: string;
  description?: string;
  retryLabel?: string;
  onRetry?: () => void;
  children?: ReactNode;
  className?: string;
}

export function ErrorState({
  title = "Gabim",
  description = "Ndodhi një gabim. Ju lutemi provoni përsëri.",
  retryLabel = "Riprovo",
  onRetry,
  children,
  className,
}: ErrorStateProps) {
  return (
    <div
      role="alert"
      className={cn(
        "flex flex-col items-center justify-center rounded-lg border border-red-200 bg-red-50 px-6 py-12 text-center",
        className,
      )}
    >
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-md border border-red-200 bg-white text-red-700">
        <AlertTriangle className="h-6 w-6" aria-hidden />
      </div>
      <h3 className="text-sm font-semibold text-red-900">{title}</h3>
      <p className="mt-2 max-w-md text-sm text-red-800">{description}</p>
      {children}
      {onRetry ? (
        <Button type="button" variant="secondary" className="mt-6" onClick={onRetry}>
          {retryLabel}
        </Button>
      ) : null}
    </div>
  );
}
