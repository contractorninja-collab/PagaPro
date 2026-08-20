import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/**
 * Text-only pill badge, in the same semantic palette as StatusPill (the tone.*
 * tokens) so a state can never be two colors on two screens.
 *
 * @deprecated for STATUS use — statuses get the dot; render StatusPill from
 * `@/components/patterns/status-pill`. Badge stays for pure-text labels.
 */
const badgeVariants = cva(
  "inline-flex h-6 items-center rounded-full border-0 px-2.5 text-xs font-semibold whitespace-nowrap",
  {
    variants: {
      variant: {
        default: "bg-brand-navy text-white",
        secondary: "bg-fill text-ink-600",
        muted: "bg-fill text-ink-600",
        outline: "bg-fill text-ink-600",
        success: "bg-tone-success-bg text-tone-success-fg",
        warning: "bg-tone-warning-bg text-tone-warning-fg",
        destructive: "bg-tone-danger-bg text-tone-danger-fg",
        info: "bg-tone-info-bg text-brand-blue",
      },
    },
    defaultVariants: {
      variant: "muted",
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
