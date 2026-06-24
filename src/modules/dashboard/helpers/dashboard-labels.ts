import type { ContractKind, PayrollPeriodStatus } from "@prisma/client";

export const PAYROLL_STATUS_LABELS_SQ: Record<PayrollPeriodStatus, string> = {
  DRAFT: "Draft",
  REVIEWED: "Në shqyrtim",
  APPROVED: "I miratuar",
  LOCKED: "I kyçur",
  ARCHIVED: "I arkivuar",
};

export { LEAVE_TYPE_LABELS_SQ } from "@/modules/leaves/helpers/leave-type-metadata";

export const CONTRACT_KIND_LABELS_SQ: Record<ContractKind, string> = {
  EMPLOYMENT: "Punësim",
  CONTRACTOR_AGREEMENT: "Kontraktor",
  AMENDMENT: "Amendament",
};
