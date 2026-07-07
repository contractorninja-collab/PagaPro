import type { PayrollPeriodStatus } from "@prisma/client";
import { Badge } from "@/components/ui/badge";

const LABELS: Record<PayrollPeriodStatus, string> = {
  DRAFT: "Draft",
  REVIEWED: "Në shqyrtim",
  APPROVED: "I miratuar",
  LOCKED: "I kyçur",
  ARCHIVED: "I arkivuar",
};

const VARIANT: Record<
  PayrollPeriodStatus,
  "warning" | "info" | "success" | "default" | "muted"
> = {
  DRAFT: "warning",
  REVIEWED: "info",
  APPROVED: "success",
  LOCKED: "default",
  ARCHIVED: "muted",
};

export function PayrollStatusBadge({ status }: { status: PayrollPeriodStatus }) {
  return <Badge variant={VARIANT[status]}>{LABELS[status]}</Badge>;
}
