"use server";

import { revalidatePath } from "next/cache";
import {
  archiveEmployee,
  createEmployee,
  deleteEmployeeHard,
  getEmployeeById,
  rehireEmployee,
  terminateEmployee,
  updateEmployee,
} from "@/modules/employees/services/employee-service";
import type { EmployeeDetailDto } from "@/modules/employees/types";
import {
  employeeUpsertSchema,
  formatEmployeeFieldErrors,
  rehireEmployeeSchema,
  terminateEmployeeSchema,
} from "@/modules/employees/validations/employee-schemas";
import { companyContextErrorMessage, getCompanyContext, requireCapability } from "@/server/company-context";
import { z } from "zod";
import { calculateEmployeeLine } from "@/modules/payroll/calculation/payroll-calculator";
import { loadPayrollLegislationContext } from "@/modules/payroll/services/payroll-settings-service";
import { D } from "@/modules/payroll/calculation/money/decimal";

export type EmployeeActionResult<T = undefined> =
  | { ok: true; data?: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

const netHourlyPreviewSchema = z.object({
  hourlyRate: z.coerce.number().positive(),
  weeklyHours: z.coerce.number().min(1).max(168).default(40),
  applyTrust: z.boolean().default(true),
  applyTax: z.boolean().default(true),
  employerPrimacy: z.enum(["PRIMARY", "SECONDARY"]).default("PRIMARY"),
});

/**
 * "≈ neto/orë" hint under the hourly-pay box. PIT is monthly-progressive, so a
 * per-hour net only exists relative to a month: we assume a standard month at
 * the contractual weekly hours (weekly × 52 ÷ 12), run the real engine with the
 * company's live parameters, and divide the monthly net back into hours.
 */
export async function previewNetHourlyRateAction(raw: unknown): Promise<
  EmployeeActionResult<{ netHourly: string; netMonthly: string; monthlyHours: string }>
> {
  try {
    const result = await getCompanyContext();
    if (!result.ok) {
      return { ok: false, error: companyContextErrorMessage(result.reason) };
    }
    const { companyId } = result.context;

    const parsed = netHourlyPreviewSchema.safeParse(raw);
    if (!parsed.success) return { ok: false, error: "Vlera jo valide." };

    const now = new Date();
    const ctx = await loadPayrollLegislationContext(companyId, now.getUTCFullYear(), now.getUTCMonth() + 1);
    if (!ctx) return { ok: false, error: "Mungojnë parametrat e pagës për kompaninë." };

    const monthlyHours = D(parsed.data.weeklyHours).mul(52).div(12).toDecimalPlaces(2);
    const line = calculateEmployeeLine(
      {
        employmentType: "EMPLOYEE",
        employerPrimacy: parsed.data.employerPrimacy,
        hours: { regularHours: monthlyHours.toFixed(2) },
        rates: { hourlyRate: String(parsed.data.hourlyRate) },
        enforceMinimumGross: false,
        applyTrust: parsed.data.applyTrust,
        applyTax: parsed.data.applyTax,
      },
      ctx.snapshot,
    );
    if (!line.ok) {
      return { ok: false, error: line.issues[0]?.message ?? "Llogaritja dështoi." };
    }

    const netMonthly = D(line.value.netPay);
    return {
      ok: true,
      data: {
        netHourly: netMonthly.div(monthlyHours).toDecimalPlaces(2).toFixed(2),
        netMonthly: netMonthly.toFixed(2),
        monthlyHours: monthlyHours.toFixed(2),
      },
    };
  } catch (err) {
    console.error("[previewNetHourlyRateAction] failed:", err);
    return { ok: false, error: "Llogaritja dështoi papritur." };
  }
}

export async function createEmployeeAction(raw: unknown): Promise<EmployeeActionResult<{ id: string }>> {
  try {
    const result = await requireCapability("employees.write");
    if (!result.ok) {
      return { ok: false, error: result.error };
    }
    const { user, companyId } = result.context;

    const parsed = employeeUpsertSchema.safeParse(raw);
    if (!parsed.success) {
      return {
        ok: false,
        error: "Ju lutem korrigjoni fushat e theksuara.",
        fieldErrors: formatEmployeeFieldErrors(parsed.error),
      };
    }

    const res = await createEmployee(companyId, parsed.data, user.id);
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
      if (res.code === "INVALID_JOB_TITLE") {
        return {
          ok: false,
          error: "Pozita e zgjedhur nuk është aktive ose nuk ekziston.",
          fieldErrors: { jobTitleId: ["Zgjidhni një pozitë aktive."] },
        };
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
    const result = await requireCapability("employees.write");
    if (!result.ok) {
      return { ok: false, error: result.error };
    }
    const { user, companyId } = result.context;

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

    const res = await updateEmployee(companyId, employeeId, parsed.data, user.id);
    if (!res.ok) {
      if (res.code === "NOT_FOUND") return { ok: false, error: "Punonjësi nuk u gjet." };
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
      if (res.code === "INVALID_JOB_TITLE") {
        return {
          ok: false,
          error: "Pozita e zgjedhur nuk është aktive ose nuk ekziston.",
          fieldErrors: { jobTitleId: ["Zgjidhni një pozitë aktive."] },
        };
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
  const result = await requireCapability("employees.write");
  if (!result.ok) {
    return { ok: false, error: result.error };
  }
  const { user, companyId } = result.context;

  const res = await archiveEmployee(companyId, employeeId, user.id);
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
  const result = await requireCapability("employees.write");
  if (!result.ok) {
    return { ok: false, error: result.error };
  }
  const { user, companyId } = result.context;

  const parsed = terminateEmployeeSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Ju lutem plotësoni të dhënat e largimit.",
      fieldErrors: formatEmployeeFieldErrors(parsed.error),
    };
  }

  const { employeeId, terminationDate, terminationReason } = parsed.data;
  const res = await terminateEmployee(companyId, employeeId, terminationDate, terminationReason, user.id);
  if (!res.ok) {
    if (res.code === "NOT_FOUND") return { ok: false, error: "Punonjësi nuk u gjet." };
    if (res.code === "ALREADY_TERMINATED") return { ok: false, error: "Punonjësi është tashmë i larguar." };
    return { ok: false, error: "Largimi nuk u regjistrua." };
  }

  revalidatePath("/punonjesit");
  revalidatePath(`/punonjesit/${employeeId}`);
  return { ok: true };
}

export async function rehireEmployeeAction(raw: unknown): Promise<EmployeeActionResult> {
  const result = await requireCapability("employees.write");
  if (!result.ok) {
    return { ok: false, error: result.error };
  }
  const { user, companyId } = result.context;

  const parsed = rehireEmployeeSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Ju lutem plotësoni datën e rikthimit.",
      fieldErrors: formatEmployeeFieldErrors(parsed.error),
    };
  }

  const res = await rehireEmployee(companyId, parsed.data.employeeId, parsed.data.rehireDate, user.id);
  if (!res.ok) {
    if (res.code === "NOT_FOUND") return { ok: false, error: "Punonjësi nuk u gjet." };
    if (res.code === "NOT_TERMINATED") {
      return { ok: false, error: "Vetëm punonjësit e larguar mund të rikthehen në punë." };
    }
    return { ok: false, error: "Rikthimi në punë dështoi." };
  }

  revalidatePath("/punonjesit");
  revalidatePath(`/punonjesit/${parsed.data.employeeId}`);
  return { ok: true };
}

export async function deleteEmployeeAction(employeeId: string): Promise<EmployeeActionResult> {
  const result = await requireCapability("employees.write");
  if (!result.ok) {
    return { ok: false, error: result.error };
  }
  const { user, companyId } = result.context;

  const res = await deleteEmployeeHard(companyId, employeeId, user.id);
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
    const result = await getCompanyContext();
    if (!result.ok) return null;
    return await getEmployeeById(result.context.companyId, employeeId);
  } catch (err) {
    console.error("[getEmployeeDetailAction] failed:", err);
    return null;
  }
}
