import { can, type PermissionSubject } from "@/server/permissions";

/**
 * Kept as a named predicate because the import UI and three routes all ask the
 * same question, but the answer now comes from the one capability matrix.
 *
 * It used to carry its own role list — OWNER, ADMIN, HR_MANAGER — which quietly
 * disagreed with the agreed matrix once ACCOUNTANT gained employees.write. Two
 * lists meant two answers to one question; there is now only one.
 *
 * Takes the full PermissionSubject (build it with `permissionSubjectOf`) so
 * the salary tier travels with the question — the import path will care about
 * it once salary-blind imports land.
 */
export function canImportEmployees(subject: PermissionSubject): boolean {
  return can(subject, "employees.write");
}
