"use server";

import { revalidatePath } from "next/cache";
import {
  archiveEmployee,
  createEmployee,
  deleteEmployeeHard,
  getEmployeeById,
  terminateEmployee,
  updateEmployee,
} from "@/modules/employees/services/employee-service";
import type { EmployeeDetailDto } from "@/modules/employees/types";
import {
  employeeUpsertSchema,
  formatEmployeeFieldErrors,
  terminateEmployeeSchema,
} from "@/modules/employees/validations/employee-schemas";
import { resolveActiveCompanyId } from "@/server/company-scope";

export type EmployeeActionResult<T = undefined> =
  | { ok: true; data?: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

async function requireCompanyId(): Promise<string | null> {
  return resolveActiveCompanyId();
}

export async function createEmployeeAction(raw: unknown): Promise<EmployeeActionResult<{ id: string }>> {
  try {
    const companyId = await requireCompanyId();
    if (!companyId) {
      return {
        ok: false,
        error:
          "Nuk ka kompani aktive. Vendosni cookie-in pp_active_company_id ose DEV_DEFAULT_COMPANY_ID për zhvillim.",
      };
    }

    const parsed = employeeUpsertSchema.safeParse(raw);
    if (!parsed.success) {
      return {
        ok: false,
        error: "Ju lutem korrigjoni fushat e theksuara.",
        fieldErrors: formatEmployeeFieldErrors(parsed.error),
      };
    }

    const res = await createEmployee(companyId, parsed.data, null);
    if (!res.ok) {
      if (res.code === "DUPLICATE_PERSONAL_ID") {
        return {
          ok: false,
          error: "Ky numër personal ekziston tashmë për këtë kompani.",
          fieldErrors: { personalId: ["Numri personal duhet të jetë unik për kompaninë"] },
        };
      }
      if (res.code === "INVALID_DEPARTMENT") {
        return { ok: false, error: "Departamenti i zgjedhur nuk është valid." };
      }
      if (res.code === "DB_ERROR") {
        let msg = "Ruajtja në databazë dështoi.";
        if (res.message && /column|does not exist|relation|Unknown arg/i.test(res.message)) {
          msg +=
            " Zakonisht kjo ndodh kur migrimi i databazës nuk është aplikuar — ekzekutoni `npx prisma migrate deploy`.";
        }
        if (process.env.NODE_ENV === "development" && res.message) {
          msg += ` (${res.message})`;
        }
        return { ok: false, error: msg };
      }
      return { ok: false, error: "Ruajtja dështoi." };
    }

    try {
      revalidatePath("/punonjesit");
      revalidatePath(`/punonjesit/${res.id}`);
    } catch (revErr) {
      console.error("[createEmployeeAction] revalidatePath failed:", revErr);
    }
    return { ok: true, data: { id: res.id } };
  } catch (err) {
    console.error("[createEmployeeAction] unexpected:", err);
    const msg = err instanceof Error ? err.message : String(err);
    return {
      ok: false,
      error: msg.length > 0 ? `Ruajtja dështoi papritur: ${msg}` : "Ruajtja dështoi papritur. Provoni përsëri.",
    };
  }
}

export async function updateEmployeeAction(raw: unknown): Promise<EmployeeActionResult> {
  try {
    const companyId = await requireCompanyId();
    if (!companyId) {
      return {
        ok: false,
        error:
          "Nuk ka kompani aktive. Vendosni cookie-in pp_active_company_id ose DEV_DEFAULT_COMPANY_ID për zhvillim.",
      };
    }

    const body = raw as { employeeId?: string; payload?: unknown };
    const employeeId = typeof body.employeeId === "string" ? body.employeeId : "";
    if (!employeeId) {
      return { ok: false, error: "ID e punonjësit mungon." };
    }

    const parsed = employeeUpsertSchema.safeParse(body.payload ?? {});
    if (!parsed.success) {
      return {
        ok: false,
        error: "Ju lutem korrigjoni fushat e theksuara.",
        fieldErrors: formatEmployeeFieldErrors(parsed.error),
      };
    }

    const res = await updateEmployee(companyId, employeeId, parsed.data, null);
    if (!res.ok) {
      if (res.code === "NOT_FOUND") return { ok: false, error: "Punonjësi nuk u gjet." };
      if (res.code === "TERMINATED_LOCKED") {
        return { ok: false, error: "Punonjësit e larguar nuk mund të përpunohen nga ky formular." };
      }
      if (res.code === "DUPLICATE_PERSONAL_ID") {
        return {
          ok: false,
          error: "Ky numër personal ekziston tashmë për këtë kompani.",
          fieldErrors: { personalId: ["Numri personal duhet të jetë unik për kompaninë"] },
        };
      }
      if (res.code === "INVALID_DEPARTMENT") {
        return { ok: false, error: "Departamenti i zgjedhur nuk është valid." };
      }
      if (res.code === "DB_ERROR") {
        let msg = "Përditësimi në databazë dështoi.";
        if (res.message && /column|does not exist|relation|Unknown arg/i.test(res.message)) {
          msg +=
            " Zakonisht kjo ndodh kur migrimi i databazës nuk është aplikuar — ekzekutoni `npx prisma migrate deploy`.";
        }
        if (process.env.NODE_ENV === "development" && res.message) {
          msg += ` (${res.message})`;
        }
        return { ok: false, error: msg };
      }
      return { ok: false, error: "Përditësimi dështoi." };
    }

    try {
      revalidatePath("/punonjesit");
      revalidatePath(`/punonjesit/${employeeId}`);
    } catch (revErr) {
      console.error("[updateEmployeeAction] revalidatePath failed:", revErr);
    }
    return { ok: true };
  } catch (err) {
    console.error("[updateEmployeeAction] unexpected:", err);
    const msg = err instanceof Error ? err.message : String(err);
    return {
      ok: false,
      error:
        msg.length > 0 ? `Përditësimi dështoi papritur: ${msg}` : "Përditësimi dështoi papritur. Provoni përsëri.",
    };
  }
}

export async function archiveEmployeeAction(employeeId: string): Promise<EmployeeActionResult> {
  const companyId = await requireCompanyId();
  if (!companyId) {
    return {
      ok: false,
      error:
        "Nuk ka kompani aktive. Vendosni cookie-in pp_active_company_id ose DEV_DEFAULT_COMPANY_ID për zhvillim.",
    };
  }

  const res = await archiveEmployee(companyId, employeeId, null);
  if (!res.ok) {
    if (res.code === "NOT_FOUND") return { ok: false, error: "Punonjësi nuk u gjet." };
    if (res.code === "TERMINATED") return { ok: false, error: "Punonjësi është tashmë i larguar." };
    return { ok: false, error: "Veprimi dështoi." };
  }

  revalidatePath("/punonjesit");
  revalidatePath(`/punonjesit/${employeeId}`);
  return { ok: true };
}

export async function terminateEmployeeAction(raw: unknown): Promise<EmployeeActionResult> {
  const companyId = await requireCompanyId();
  if (!companyId) {
    return {
      ok: false,
      error:
        "Nuk ka kompani aktive. Vendosni cookie-in pp_active_company_id ose DEV_DEFAULT_COMPANY_ID për zhvillim.",
    };
  }

  const parsed = terminateEmployeeSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Ju lutem plotësoni të dhënat e largimit.",
      fieldErrors: formatEmployeeFieldErrors(parsed.error),
    };
  }

  const { employeeId, terminationDate, terminationReason } = parsed.data;
  const res = await terminateEmployee(companyId, employeeId, terminationDate, terminationReason, null);
  if (!res.ok) {
    if (res.code === "NOT_FOUND") return { ok: false, error: "Punonjësi nuk u gjet." };
    return { ok: false, error: "Largimi nuk u regjistrua." };
  }

  revalidatePath("/punonjesit");
  revalidatePath(`/punonjesit/${employeeId}`);
  return { ok: true };
}

export async function deleteEmployeeAction(employeeId: string): Promise<EmployeeActionResult> {
  const companyId = await requireCompanyId();
  if (!companyId) {
    return {
      ok: false,
      error:
        "Nuk ka kompani aktive. Vendosni cookie-in pp_active_company_id ose DEV_DEFAULT_COMPANY_ID për zhvillim.",
    };
  }

  const res = await deleteEmployeeHard(companyId, employeeId, null);
  if (!res.ok) {
    if (res.code === "NOT_FOUND") return { ok: false, error: "Punonjësi nuk u gjet." };
    if (res.code === "NOT_ELIGIBLE") {
      return {
        ok: false,
        error: "Fshirja nuk lejohet: ekzistojnë hyrje në payroll ose kontrata të lidhura.",
      };
    }
    return { ok: false, error: "Fshirja dështoi." };
  }

  revalidatePath("/punonjesit");
  return { ok: true };
}

export async function getEmployeeDetailAction(employeeId: string): Promise<EmployeeDetailDto | null> {
  try {
    const companyId = await requireCompanyId();
    if (!companyId) return null;
    return await getEmployeeById(companyId, employeeId);
  } catch (err) {
    console.error("[getEmployeeDetailAction] failed:", err);
    return null;
  }
}
