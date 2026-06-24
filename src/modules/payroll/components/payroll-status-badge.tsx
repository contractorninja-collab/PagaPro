import type { PayrollPeriodStatus } from "@prisma/client";
import { Badge } from "@/components/ui/badge";

const LABELS: Record<PayrollPeriodStatus, string> = {
  DRAFT: "Draft",
  REVIEWED: "Në shqyrtim",
  APPROVED: "I miratuar",
  LOCKED: "I kyçur",
  ARCHIVED: "I arkivuar",
};

const VARIANT: Record<PayrollPeriodStatus, "secondary" | "warning" | "success" | "default" | "outline"> = {
  DRAFT: "secondary",
  REVIEWED: "warning",
  APPROVED: "success",
  LOCKED: "default",
  ARCHIVED: "outline",
};

export function PayrollStatusBadge({ status }: { status: PayrollPeriodStatus }) {
  return (
    <Badge variant={VARIANT[status]} className="whitespace-nowrap">
      {LABELS[status]}
    </Badge>
  );
}
