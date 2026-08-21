import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Empty state for a section INSIDE a card — icon in a soft ring, one line of
 * meaning, an optional action. Replaces the bare grey one-liners that made
 * empty sections look broken rather than simply empty.
 */
export function EmptySection({
  icon: Icon,
  title,
  hint,
  action,
  className,
}: {
  icon: LucideIcon;
  title: string;
  hint?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center gap-2 px-6 py-10 text-center", className)}>
      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-fill">
        <Icon className="h-5 w-5 text-ink-400" aria-hidden />
      </span>
      <p className="text-[13.5px] font-semibold text-ink-900">{title}</p>
      {hint ? <p className="max-w-sm text-[12.5px] leading-relaxed text-ink-500">{hint}</p> : null}
      {action ? <div className="mt-1.5">{action}</div> : null}
    </div>
  );
}
