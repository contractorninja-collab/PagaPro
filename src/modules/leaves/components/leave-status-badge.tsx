import type { LeaveRequestStatus } from "@prisma/client";
import { LEAVE_STATUS_LABELS_SQ } from "@/modules/leaves/helpers/leave-status-labels";
import { TonePill, type SemanticTone } from "@/modules/leaves/components/leave-ui";

const TONE: Record<LeaveRequestStatus, SemanticTone> = {
  DRAFT: "warning",
  PENDING: "warning",
  APPROVED: "success",
  REJECTED: "destructive",
  CANCELLED: "neutral",
};

export function LeaveStatusBadge({ status }: { status: LeaveRequestStatus }) {
  return <TonePill tone={TONE[status]}>{LEAVE_STATUS_LABELS_SQ[status]}</TonePill>;
}
