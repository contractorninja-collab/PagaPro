"use server";

import { revalidatePath } from "next/cache";
import {
  createDepartment,
  deleteDepartment,
  listDepartmentsForCompany,
  listDepartmentsWithEmployeeCounts,
  renameDepartment,
} from "@/modules/departments/services/department-service";
import type { DepartmentWithEmployeeCountDto } from "@/modules/departments/services/department-service";
import {
  createDepartmentSchema,
  deleteDepartmentSchema,
  renameDepartmentSchema,
} from "@/modules/departments/validation/department-schemas";
import type { DepartmentOptionDto } from "@/modules/employees/types";
import { companyContextErrorMessage, getCompanyContext } from "@/server/company-context";
import { can, capabilityDeniedMessage, type Capability } from "@/server/permissions";

const REVALIDATE_PATHS = ["/konfigurime", "/punonjesit", "/paneli", "/pushimet", "/raportet"] as const;

function revalidateDepartmentPaths(): void {
  for (const path of REVALIDATE_PATHS) {
    revalidatePath(path);
  }
}

/**
 * `capability` is required rather than optional on purpose: a new action here
 * has to say whether it reads or writes, so it cannot ship ungated by omission.
 * Departments are HR data, so writing them is employees.write — not
 * company.settings — even though the UI lives under Konfigurimet.
 */
async function companyIdOrError(
  capability: Capability | null,
): Promise<{ ok: true; companyId: string } | { ok: false; error: string }> {
  const result = await getCompanyContext();
  if (!result.ok) return { ok: false, error: companyContextErrorMessage(result.reason) };

  const { user, role, companyId } = result.context;
  if (capability && !can({ role, isPlatformAdmin: user.isPlatformAdmin }, capability)) {
    return { ok: false, error: capabilityDeniedMessage(capability) };
  }
  return { ok: true, companyId };
}

function mutationError(
  code: "DUPLICATE_NAME" | "NOT_FOUND" | "DB_ERROR",
  message?: string,
): { ok: false; error: string } {
  if (code === "DUPLICATE_NAME") {
    return { ok: false, error: "Ky emër departamenti ekziston tashmë për këtë kompani." };
  }
  if (code === "NOT_FOUND") {
    return { ok: false, error: "Departamenti nuk u gjet." };
  }
  return { ok: false, error: message ?? "Operacioni dështoi." };
}

export async function loadDepartmentsAction(): Promise<
  { ok: true; departments: DepartmentWithEmployeeCountDto[] } | { ok: false; error: string }
> {
  const company = await companyIdOrError(null);
  if (!company.ok) return company;

  const departments = await listDepartmentsWithEmployeeCounts(company.companyId);
  return { ok: true, departments };
}

export async function loadDepartmentOptionsAction(): Promise<
  { ok: true; departments: DepartmentOptionDto[] } | { ok: false; error: string }
> {
  const company = await companyIdOrError(null);
  if (!company.ok) return company;

  const departments = await listDepartmentsForCompany(company.companyId);
  return { ok: true, departments };
}

export async function createDepartmentAction(
  raw: unknown,
): Promise<{ ok: true; id: string; name: string } | { ok: false; error: string }> {
  const company = await companyIdOrError("employees.write");
  if (!company.ok) return company;

  const parsed = createDepartmentSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Emri i departamentit nuk është valid." };
  }

  const res = await createDepartment(company.companyId, parsed.data.name);
  if (!res.ok) return mutationError(res.code, res.message);

  revalidateDepartmentPaths();
  return { ok: true, id: res.id, name: parsed.data.name.trim() };
}

export async function renameDepartmentAction(
  raw: unknown,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const company = await companyIdOrError("employees.write");
  if (!company.ok) return company;

  const parsed = renameDepartmentSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Të dhënat nuk janë valide." };
  }

  const res = await renameDepartment(company.companyId, parsed.data.id, parsed.data.name);
  if (!res.ok) return mutationError(res.code, res.message);

  revalidateDepartmentPaths();
  return { ok: true };
}

export async function deleteDepartmentAction(
  raw: unknown,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const company = await companyIdOrError("employees.write");
  if (!company.ok) return company;

  const parsed = deleteDepartmentSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "ID jo valid." };

  const res = await deleteDepartment(company.companyId, parsed.data.id);
  if (!res.ok) return mutationError(res.code, res.message);

  revalidateDepartmentPaths();
  return { ok: true };
}
