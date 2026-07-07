import type { LeaveRequestStatus } from "@prisma/client";
import { Badge } from "@/components/ui/badge";
import { LEAVE_STATUS_LABELS_SQ } from "@/modules/leaves/helpers/leave-status-labels";

const VARIANT: Record<
  LeaveRequestStatus,
  "warning" | "success" | "destructive" | "muted" | "info"
> = {
  DRAFT: "warning",
  PENDING: "warning",
  APPROVED: "success",
  REJECTED: "destructive",
  CANCELLED: "muted",
};

export function LeaveStatusBadge({ status }: { status: LeaveRequestStatus }) {
  return <Badge variant={VARIANT[status]}>{LEAVE_STATUS_LABELS_SQ[status]}</Badge>;
}
