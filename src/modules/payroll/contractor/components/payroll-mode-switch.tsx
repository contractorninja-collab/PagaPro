import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * Segmented Rregullt / Kontraktor switch for the Pagat area. Rendered only when
 * the company has contractorPayrollEnabled — a single-flow company never sees it.
 */
export function PayrollModeSwitch({ mode }: { mode: "regular" | "kontraktor" }) {
  const pill =
    "inline-flex h-9 items-center rounded-[8px] px-4 text-[13px] font-semibold transition-colors";
  return (
    <div className="mb-4 inline-flex items-center gap-1 rounded-[10px] border border-[#e2e8f0] bg-white p-1">
      <Link
        href="/pagat"
        className={cn(
          pill,
          mode === "regular" ? "bg-brand-blue text-white" : "text-[#64748b] hover:bg-[#f1f5f9]",
        )}
      >
        Rregullt
      </Link>
      <Link
        href="/pagat/kontraktor"
        className={cn(
          pill,
          mode === "kontraktor" ? "bg-brand-blue text-white" : "text-[#64748b] hover:bg-[#f1f5f9]",
        )}
      >
        Kontraktor
      </Link>
    </div>
  );
}
