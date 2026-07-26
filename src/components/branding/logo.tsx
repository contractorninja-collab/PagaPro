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
  /**
   * "tile" draws the navy plate (app icon, favicon scale); "bare" draws the ring
   * alone for placement on an existing navy or light surface.
   */
  surface?: "tile" | "bareOnDark" | "bareOnLight";
}

/**
 * Icon mark — the "Rrota" ring: an open ring whose 12→3 segment is brand blue.
 * The geometry is authored on a 64-unit grid and scales with `size`; the segment
 * never rotates, per the brand sheet.
 */
export function PagaProMark({
  size = 32,
  className,
  rounded = "md",
  surface = "tile",
}: PagaProMarkProps) {
  // 15/64 matches the app icon's 240/1024 corner radius.
  const rx = rounded === "sm" ? 12 : 15;
  const ringColor =
    surface === "bareOnLight" ? BRAND.navy : surface === "tile" ? BRAND.canvas : BRAND.wordmarkOnDark;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      className={cn("shrink-0", className)}
      aria-hidden
    >
      {surface === "tile" ? <rect width="64" height="64" rx={rx} fill={BRAND.navy} /> : null}
      <path
        d="M52.20 35.47 A20.5 20.5 0 1 1 28.44 11.55"
        fill="none"
        stroke={ringColor}
        strokeWidth="8"
        strokeLinecap="round"
      />
      <path
        d="M32 11.5 A20.5 20.5 0 0 1 52.19 28.54"
        fill="none"
        stroke={BRAND.blue}
        strokeWidth="8"
        strokeLinecap="round"
      />
    </svg>
  );
}
