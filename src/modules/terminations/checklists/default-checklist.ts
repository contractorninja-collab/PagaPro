export const CHECKLIST_KEYS = {
  DOC_GENERATED: "doc_generated",
  FINAL_PAYROLL: "final_payroll_prep",
  EQUIPMENT_RETURNED: "equipment_returned",
  ACCESS_REVOKED: "access_revoked",
  DOCS_ARCHIVED: "docs_archived",
  EMPLOYEE_MARKED_LEFT: "employee_marked_left",
} as const;

export function defaultTerminationChecklistRows(): Array<{ itemKey: string; label: string }> {
  return [
    { itemKey: CHECKLIST_KEYS.DOC_GENERATED, label: "Dokumenti i largimit u gjenerua" },
    { itemKey: CHECKLIST_KEYS.FINAL_PAYROLL, label: "Final payroll u përgatit" },
    { itemKey: CHECKLIST_KEYS.EQUIPMENT_RETURNED, label: "Pajisjet u kthyen" },
    { itemKey: CHECKLIST_KEYS.ACCESS_REVOKED, label: "Qasjet në sistem u mbyllën" },
    { itemKey: CHECKLIST_KEYS.DOCS_ARCHIVED, label: "Dokumentet u arkivuan" },
    { itemKey: CHECKLIST_KEYS.EMPLOYEE_MARKED_LEFT, label: "Punonjësi u shënua si i larguar" },
  ];
}
