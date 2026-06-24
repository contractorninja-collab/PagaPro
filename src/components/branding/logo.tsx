import Link from "next/link";
import { cn } from "@/lib/utils";
import { BRAND } from "@/components/branding/brand-tokens";

export type LogoVariant = "default" | "compact" | "onDark";

const sizeClasses: Record<LogoVariant, string> = {
  default: "text-[1.375rem] leading-none sm:text-2xl",
  compact: "text-base leading-none",
  onDark: "text-lg leading-none sm:text-xl",
};

interface PagaProLogoProps {
  variant?: LogoVariant;
  className?: string;
  /** Wrap in link to home */
  asLink?: boolean;
  /** Accessible label */
  "aria-label"?: string;
  /** Parent provides name (e.g. wrapping Link) — avoids duplicate SR output */
  ariaHidden?: boolean;
}

/**
 * Wordmark: **Paga** (navy / light-on-dark) + **PRO** (professional blue).
 * Tight tracking, bold Inter — operational enterprise tone.
 */
export function PagaProLogo({
  variant = "default",
  className,
  asLink = false,
  "aria-label": ariaLabel = "PagaPRO — ballina",
  ariaHidden = false,
}: PagaProLogoProps) {
  const isDark = variant === "onDark";

  const inner = (
    <span
      className={cn(
        "inline-flex items-baseline font-bold tracking-[-0.04em] select-none",
        sizeClasses[variant],
        className,
      )}
    >
      <span style={{ color: isDark ? BRAND.wordmarkOnDark : BRAND.navy }}>Paga</span>
      <span style={{ color: BRAND.blue }} className="font-extrabold">
        PRO
      </span>
    </span>
  );

  if (ariaHidden) {
    return (
      <span className="inline-flex" aria-hidden>
        {inner}
      </span>
    );
  }

  if (asLink) {
    return (
      <Link href="/" className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring rounded-sm" aria-label={ariaLabel}>
        {inner}
      </Link>
    );
  }

  return (
    <span className="inline-flex" role="img" aria-label={ariaLabel}>
      {inner}
    </span>
  );
}

/** Horizontal strip — smaller footprint for headers / mobile */
export function PagaProLogoCompact(props: Omit<PagaProLogoProps, "variant">) {
  return <PagaProLogo {...props} variant="compact" />;
}

interface PagaProMarkProps {
  size?: number;
  className?: string;
  /** For sidebar strip or favicon-scale UI */
  rounded?: "sm" | "md";
}

/**
 * Icon mark: navy tile + **PP** monogram (operations / payroll trust cue).
 * SVG text uses system UI stack so it renders without loading Inter in standalone SVG contexts.
 */
export function PagaProMark({ size = 32, className, rounded = "md" }: PagaProMarkProps) {
  const rx = rounded === "sm" ? 6 : 8;
  const fs = Math.round(size * 0.38);
  const y = Math.round(size * 0.67);

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className={cn("shrink-0 overflow-visible", className)}
      aria-hidden
    >
      <rect width={size} height={size} rx={rx} fill={BRAND.navy} />
      <text
        x={size / 2}
        y={y}
        textAnchor="middle"
        fontFamily="ui-sans-serif, system-ui, -apple-system, Segoe UI, Inter, sans-serif"
        fontSize={fs}
        fontWeight="700"
        letterSpacing={`-${size * 0.02}`}
      >
        <tspan fill={BRAND.canvas}>P</tspan>
        <tspan fill={BRAND.blue}>P</tspan>
      </text>
    </svg>
  );
}
