import type { CompanyMembershipRole } from "@prisma/client";

const EMPLOYEE_IMPORT_ROLES = new Set<CompanyMembershipRole>([
  "OWNER",
  "ADMIN",
  "HR_MANAGER",
]);

export function canImportEmployees(params: {
  role: CompanyMembershipRole | null;
  isPlatformAdmin: boolean;
}): boolean {
  return params.isPlatformAdmin || (params.role != null && EMPLOYEE_IMPORT_ROLES.has(params.role));
}
