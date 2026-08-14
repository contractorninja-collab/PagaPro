import type { CompanyMembershipRole } from "@prisma/client";
import { can } from "@/server/permissions";

/**
 * Kept as a named predicate because the import UI and three routes all ask the
 * same question, but the answer now comes from the one capability matrix.
 *
 * It used to carry its own role list — OWNER, ADMIN, HR_MANAGER — which quietly
 * disagreed with the agreed matrix once ACCOUNTANT gained employees.write. Two
 * lists meant two answers to one question; there is now only one.
 */
export function canImportEmployees(params: {
  role: CompanyMembershipRole | null;
  isPlatformAdmin: boolean;
}): boolean {
  return can(params, "employees.write");
}
