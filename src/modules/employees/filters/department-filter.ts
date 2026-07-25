export const UNASSIGNED_DEPARTMENT_FILTER = "__unassigned__";

export function employeeDepartmentWhere(
  departmentId: string | null | undefined,
): { departmentId?: string | null } {
  if (departmentId === UNASSIGNED_DEPARTMENT_FILTER) {
    return { departmentId: null };
  }
  return departmentId ? { departmentId } : {};
}

export function employeeDepartmentHref(departmentId: string | null): string {
  const value = departmentId ?? UNASSIGNED_DEPARTMENT_FILTER;
  return `/punonjesit?departmentId=${encodeURIComponent(value)}`;
}
