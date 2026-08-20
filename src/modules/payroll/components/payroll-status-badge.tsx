import type { PayrollPeriodStatus } from "@prisma/client";
import { Lock } from "lucide-react";
import { StatusPill, type StatusTone } from "@/components/patterns/status-pill";

const LABELS: Record<PayrollPeriodStatus, string> = {
  DRAFT: "Draft",
  REVIEWED: "Në shqyrtim",
  APPROVED: "I miratuar",
  LOCKED: "I kyçur",
  ARCHIVED: "I arkivuar",
};

const TONES: Record<PayrollPeriodStatus, StatusTone> = {
  DRAFT: "warning",
  REVIEWED: "info",
  APPROVED: "success",
  LOCKED: "locked",
  ARCHIVED: "neutral",
};

export function PayrollStatusBadge({ status }: { status: PayrollPeriodStatus }) {
  return (
    <StatusPill
      tone={TONES[status]}
      icon={status === "LOCKED" ? <Lock className="h-[11px] w-[11px]" strokeWidth={2.5} aria-hidden /> : undefined}
    >
      {LABELS[status]}
    </StatusPill>
  );
}
