import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/**
 * THE button. Flat 1b look: solid brand blue primary, one radius (9px), no
 * drop shadows. The nine per-module BTN_* constants are now thin
 * `buttonVariants(...)` calls over this cva, so a button cannot drift into
 * its own height, radius or hover again.
 */
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-btn font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue/40 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-brand-blue text-white hover:bg-brand-blue-strong",
        secondary: "border border-line bg-white text-ink-700 hover:bg-fill-hover",
        ghost: "text-ink-700 hover:bg-fill-hover",
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        destructiveOutline: "border border-tone-danger-border bg-white text-tone-danger-fg hover:bg-tone-danger-bg",
        outlinePrimary: "border border-brand-blue bg-transparent text-brand-blue hover:bg-tone-info-bg",
        link: "text-brand-blue underline-offset-4 hover:underline",
      },
      size: {
        sm: "h-8 px-3 text-[12.5px]",
        default: "h-9 px-4 text-[13px]",
        lg: "h-10 px-[18px] text-[13.5px]",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
