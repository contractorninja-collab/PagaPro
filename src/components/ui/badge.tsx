import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/** Pill status badges — consistent across payroll, HR, contracts, and leaves. */
const badgeVariants = cva(
  "inline-flex h-6 items-center rounded-full border-0 px-2.5 text-xs font-semibold whitespace-nowrap",
  {
    variants: {
      variant: {
        default: "bg-[#0f172a] text-white",
        secondary: "bg-[#f1f5f9] text-[#475569]",
        muted: "bg-[#f1f5f9] text-[#475569]",
        outline: "bg-[#f1f5f9] text-[#475569]",
        success: "bg-[#dcfce7] text-[#166534]",
        warning: "bg-[#fef3c7] text-[#92400e]",
        destructive: "bg-[#fee2e2] text-[#991b1b]",
        info: "bg-[#dbeafe] text-[#1e40af]",
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
