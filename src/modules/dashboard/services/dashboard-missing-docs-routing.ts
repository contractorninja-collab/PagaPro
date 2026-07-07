import type { DocumentsMissingEmployeeRef } from "../types/dashboard-types";

export function missingDocsHref(employees: DocumentsMissingEmployeeRef[]): string {
  if (employees.length === 1) {
    return `/punonjesit/${employees[0]!.id}?edit=documents`;
  }
  return "/punonjesit?documentsMissing=1";
}
