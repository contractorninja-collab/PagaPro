import { prisma } from "@/lib/prisma";
import type { DepartmentOptionDto } from "@/modules/employees/types";

export interface DepartmentWithEmployeeCountDto {
  id: string;
  name: string;
  employeeCount: number;
}

export type DepartmentMutationResult =
  | { ok: true; id: string }
  | { ok: false; code: "DUPLICATE_NAME" | "NOT_FOUND" | "DB_ERROR"; message?: string };

function duplicateName(err: unknown): boolean {
  return (err as { code?: string })?.code === "P2002";
}

export async function listDepartmentsForCompany(companyId: string): Promise<DepartmentOptionDto[]> {
  const rows = await prisma.department.findMany({
    where: { companyId },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
  return rows;
}

export async function listDepartmentsWithEmployeeCounts(
  companyId: string,
): Promise<DepartmentWithEmployeeCountDto[]> {
  const rows = await prisma.department.findMany({
    where: { companyId },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      _count: { select: { employees: true } },
    },
  });

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    employeeCount: row._count.employees,
  }));
}

export async function createDepartment(
  companyId: string,
  name: string,
): Promise<DepartmentMutationResult> {
  const trimmed = name.trim();
  try {
    const row = await prisma.department.create({
      data: { companyId, name: trimmed },
      select: { id: true },
    });
    return { ok: true, id: row.id };
  } catch (err) {
    if (duplicateName(err)) return { ok: false, code: "DUPLICATE_NAME" };
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, code: "DB_ERROR", message };
  }
}

export async function renameDepartment(
  companyId: string,
  id: string,
  name: string,
): Promise<DepartmentMutationResult> {
  const trimmed = name.trim();
  try {
    const row = await prisma.department.updateMany({
      where: { id, companyId },
      data: { name: trimmed },
    });
    if (row.count === 0) return { ok: false, code: "NOT_FOUND" };
    return { ok: true, id };
  } catch (err) {
    if (duplicateName(err)) return { ok: false, code: "DUPLICATE_NAME" };
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, code: "DB_ERROR", message };
  }
}

export async function deleteDepartment(companyId: string, id: string): Promise<DepartmentMutationResult> {
  try {
    const row = await prisma.department.deleteMany({
      where: { id, companyId },
    });
    if (row.count === 0) return { ok: false, code: "NOT_FOUND" };
    return { ok: true, id };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, code: "DB_ERROR", message };
  }
}
