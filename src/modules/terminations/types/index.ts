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

/**
 * The termination decision documents that can be printed for any termination.
 * Names match templates/termination/manifest.json. `key` is the
 * `terminationWorkflowKey` used to resolve the template (storage or bundled).
 */
export const TERMINATION_TEMPLATE_OPTIONS: ReadonlyArray<{ key: TerminationType; name: string }> = [
  { key: "LARGIM_VULLNETAR", name: "Vendim për largim vullnetar" },
  { key: "PA_PARALAJMERIM", name: "Vendim për ndërprerje pa paralajmërim" },
  { key: "MARREVESHJE_E_DYANSHME", name: "Marrëveshje për ndërprerje" },
  { key: "NGA_PUNEDHENESI", name: "Vendim për ndërprerje nga punëdhënësi" },
  { key: "MANUAL", name: "Vendim manual për ndërprerje" },
];

export const TERMINATION_STATUS_LABELS: Record<string, string> = {
  DRAFT: "Draft",
  PENDING_REVIEW: "Në shqyrtim",
  APPROVED: "I miratuar",
  COMPLETED: "I përfunduar",
  CANCELLED: "I anuluar",
};
