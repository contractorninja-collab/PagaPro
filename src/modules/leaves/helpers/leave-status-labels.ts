import type { LeaveRequestStatus } from "@prisma/client";

export const LEAVE_STATUS_LABELS_SQ: Record<LeaveRequestStatus, string> = {
  DRAFT: "Draft",
  PENDING: "Në pritje",
  APPROVED: "I miratuar",
  REJECTED: "I refuzuar",
  CANCELLED: "I anuluar",
};
