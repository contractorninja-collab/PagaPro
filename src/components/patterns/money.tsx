import { cn } from "@/lib/utils";

/**
 * Money set like money: the integer part carries the size, the cents and the
 * euro sign step back — the annual-report treatment. Expects a pre-formatted
 * Albanian amount ("18.420,00 €" / "1.611,75 €"); anything unparseable
 * renders unchanged so a "—" or empty string can pass straight through.
 */
export function Money({ value, className }: { value: string; className?: string }) {
  const m = /^(-?[\d.]+)(,\d{2})?(\s*€)?$/.exec(value.trim());
  if (!m) return <span className={cn("tabular-nums", className)}>{value}</span>;
  const [, whole, cents, euro] = m;
  return (
    <span className={cn("tabular-nums", className)}>
      {whole}
      {cents || euro ? (
        <span className="text-[0.62em] font-medium text-ink-400">
          {cents ?? ""}
          {euro ? " €" : ""}
        </span>
      ) : null}
    </span>
  );
}
