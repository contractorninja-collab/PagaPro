import { Check, Lock } from "lucide-react";
import { cn } from "@/lib/utils";

export type StepCircleState = "done" | "active" | "idle" | "blocked";

/**
 * The numbered bullet on a step rail: a check once done, an outlined number
 * while active, a padlock when an earlier step must happen first.
 *
 * Shared by the document generation wizard and the Konfigurimet setup card so
 * the two rails cannot drift apart.
 */
export function StepCircle({ state, index }: { state: StepCircleState; index: number }) {
  if (state === "done") {
    return (
      <span className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-full bg-brand-blue text-white">
        <Check className="h-3.5 w-3.5" aria-hidden />
      </span>
    );
  }
  if (state === "blocked") {
    return (
      <span className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-full bg-[#f1f5f9] text-[#cbd5e1]">
        <Lock className="h-3 w-3" aria-hidden />
      </span>
    );
  }
  return (
    <span
      className={cn(
        "flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-full text-[12px] font-bold",
        state === "active"
          ? "border-2 border-brand-blue bg-[#eff6ff] text-brand-blue"
          : "bg-[#f1f5f9] text-[#94a3b8]",
      )}
    >
      {index + 1}
    </span>
  );
}
