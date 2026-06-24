import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface DataTableToolbarProps {
  /** Filters / search row above table */
  toolbar?: ReactNode;
  /** Optional caption for accessibility */
  caption?: string;
  children: ReactNode;
  className?: string;
}

/**
 * Wrapper for dense operational tables — compose with `Table` from `@/components/ui/table`.
 * Use `table-dense` on `<table>` for tighter rows when needed.
 */
export function DataTableShell({ toolbar, caption, children, className }: DataTableToolbarProps) {
  return (
    <div className={cn("space-y-3", className)}>
      {toolbar ? <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">{toolbar}</div> : null}
      <div className="relative">
        {caption ? <span className="sr-only">{caption}</span> : null}
        {children}
      </div>
    </div>
  );
}
