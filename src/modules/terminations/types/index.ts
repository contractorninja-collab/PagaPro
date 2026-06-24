import type { TerminationType } from "@prisma/client";

export const TERMINATION_ENTITY = "Termination";

export const TERMINATION_TIMELINE = {
  CREATED: "TERMINATION_CREATED",
  DOCUMENT_GENERATED: "TERMINATION_DOCUMENT_GENERATED",
  FINAL_PAYROLL_PREPARED: "TERMINATION_FINAL_PAYROLL_PREPARED",
  APPROVED: "TERMINATION_APPROVED",
  EMPLOYEE_TERMINATED: "TERMINATION_EMPLOYEE_MARKED_LEFT",
  CANCELLED: "TERMINATION_CANCELLED",
} as const;

export const TERMINATION_TYPE_LABELS: Record<TerminationType, string> = {
  LARGIM_VULLNETAR: "Largim vullnetar",
  PA_PARALAJMERIM: "Pa paralajmërim",
  MARREVESHJE_E_DYANSHME: "Marrëveshje e dyanshme",
  NGA_PUNEDHENESI: "Nga punëdhënësi",
  MANUAL: "Manual",
};

export const TERMINATION_STATUS_LABELS: Record<string, string> = {
  DRAFT: "Draft",
  PENDING_REVIEW: "Në shqyrtim",
  APPROVED: "I miratuar",
  COMPLETED: "I përfunduar",
  CANCELLED: "I anuluar",
};
