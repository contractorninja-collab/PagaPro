import { BRAND } from "@/components/branding/brand-tokens";
import { cn } from "@/lib/utils";

export interface ReportBrandHeaderProps {
  /** Report title e.g. “Regjistri i pagave — Maj 2026” */
  title: string;
  /** Optional subtitle / company legal line */
  subtitle?: string;
  /** ISO-ish generation stamp */
  generatedLabel?: string;
  className?: string;
}

/**
 * Print-oriented letterhead block — embed in HTML→PDF pipelines or preview in-app.
 * Uses flat fills only (no gradients).
 */
export function ReportBrandHeader({
  title,
  subtitle,
  generatedLabel = "Gjeneruar nga PagaPRO",
  className,
}: ReportBrandHeaderProps) {
  return (
    <header
      className={cn("border-b-2 pb-4", className)}
      style={{ borderColor: BRAND.navy }}
    >
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex items-center gap-4">
          <svg width={40} height={40} viewBox="0 0 40 40" className="shrink-0" aria-hidden>
            <rect width={40} height={40} rx={9} fill={BRAND.navy} />
            <text
              x={20}
              y={27}
              textAnchor="middle"
              fontFamily="ui-sans-serif, system-ui, Inter, sans-serif"
              fontSize={15}
              fontWeight="700"
              letterSpacing="-0.06em"
            >
              <tspan fill={BRAND.canvas}>P</tspan>
              <tspan fill={BRAND.blue}>P</tspan>
            </text>
          </svg>
          <div>
            <div className="flex items-baseline gap-0 font-bold tracking-tight" style={{ fontFamily: "inherit" }}>
              <span style={{ color: BRAND.navy }} className="text-xl">
                Paga
              </span>
              <span style={{ color: BRAND.blue }} className="text-xl font-extrabold">
                PRO
              </span>
            </div>
            <p className="mt-1 text-xs font-medium uppercase tracking-wide" style={{ color: BRAND.textMuted }}>
              Platformë operative për punonjësit dhe pagat
            </p>
          </div>
        </div>
        <div className="text-right text-xs" style={{ color: BRAND.textMuted }}>
          <p className="font-medium" style={{ color: BRAND.text }}>
            {generatedLabel}
          </p>
          {subtitle ? <p className="mt-1 max-w-xs">{subtitle}</p> : null}
        </div>
      </div>
      <h1 className="mt-6 text-lg font-semibold tracking-tight" style={{ color: BRAND.text }}>
        {title}
      </h1>
    </header>
  );
}
