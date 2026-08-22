import type { PayrollPeriodStatus } from "@prisma/client";

export const PAYROLL_STATUS_LABELS_SQ: Record<PayrollPeriodStatus, string> = {
  DRAFT: "Draft",
  REVIEWED: "Në shqyrtim",
  APPROVED: "I miratuar",
  LOCKED: "I kyçur",
  ARCHIVED: "I arkivuar",
};

export { LEAVE_TYPE_LABELS_SQ } from "@/modules/leaves/helpers/leave-type-metadata";

/**
 * Contract *kind* labels lived here for the expiry alert. That alert now reads
 * the employee's contract term and labels it with CONTRACT_TERM_LABELS from
 * the annex module, so nothing needed these.
 */
