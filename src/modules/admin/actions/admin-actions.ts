"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getCurrentUser } from "@/modules/auth/services/session";
import { provisionCompany } from "@/modules/admin/services/company-provisioning";
import {
  createCompanyUserForAdmin,
  resetUserPasswordForAdmin,
  setCompanyStatusForAdmin,
  setMembershipActiveForAdmin,
  updateCompanyForAdmin,
} from "@/modules/admin/services/admin-service";
import {
  companyStatusSchema,
  companyUpsertSchema,
  createCompanyUserSchema,
  formatAdminFieldErrors,
} from "@/modules/admin/validation/admin-schemas";

export type AdminActionResult<T = undefined> =
  | { ok: true; data?: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

const NOT_AUTHORIZED = "Nuk keni qasje në konsolën e administratorit.";

async function requireAdmin(): Promise<boolean> {
  const user = await getCurrentUser();
  return Boolean(user?.isPlatformAdmin && !user.mustChangePassword);
}

function revalidateBizneset(companyId?: string) {
  try {
    revalidatePath("/admin/bizneset");
    if (companyId) revalidatePath(`/admin/bizneset/${companyId}`);
  } catch (err) {
    console.error("[admin-actions] revalidatePath failed:", err);
  }
}

export async function createCompanyAction(raw: unknown): Promise<AdminActionResult<{ id: string }>> {
  try {
    if (!(await requireAdmin())) return { ok: false, error: NOT_AUTHORIZED };

    const parsed = companyUpsertSchema.safeParse(raw);
    if (!parsed.success) {
      return {
        ok: false,
        error: "Ju lutem korrigjoni fushat e theksuara.",
        fieldErrors: formatAdminFieldErrors(parsed.error),
      };
    }

    const res = await provisionCompany(parsed.data);
    if (!res.ok) {
      if (res.code === "DUPLICATE_NUI") {
        return {
          ok: false,
          error: "Ky NUI ekziston tashmë.",
          fieldErrors: { fiscalNumber: ["NUI duhet të jetë unik."] },
        };
      }
      if (res.code === "DUPLICATE_NRB") {
        return {
          ok: false,
          error: "Ky NRB ekziston tashmë.",
          fieldErrors: { businessRegistrationNumber: ["NRB duhet të jetë unik."] },
        };
      }
      if (res.code === "DUPLICATE_SLUG") {
        return {
          ok: false,
          error: "Ky slug ekziston tashmë.",
          fieldErrors: { slug: ["Zgjidhni një slug tjetër për domain-in e klientit."] },
        };
      }
      if (res.code === "DUPLICATE_DOMAIN") {
        return {
          ok: false,
          error: "Ky domain ekziston tashmë.",
          fieldErrors: { customDomain: ["Domain duhet të jetë unik."] },
        };
      }
      return { ok: false, error: "Krijimi i biznesit dështoi." };
    }

    revalidateBizneset(res.id);
    return { ok: true, data: { id: res.id } };
  } catch (err) {
    console.error("[createCompanyAction] unexpected:", err);
    return { ok: false, error: "Krijimi i biznesit dështoi papritur." };
  }
}

export async function updateCompanyAction(raw: unknown): Promise<AdminActionResult> {
  try {
    if (!(await requireAdmin())) return { ok: false, error: NOT_AUTHORIZED };

    const body = raw as { companyId?: string; payload?: unknown };
    const companyId = typeof body.companyId === "string" ? body.companyId : "";
    if (!companyId) return { ok: false, error: "ID e biznesit mungon." };

    const parsed = companyUpsertSchema.safeParse(body.payload ?? {});
    if (!parsed.success) {
      return {
        ok: false,
        error: "Ju lutem korrigjoni fushat e theksuara.",
        fieldErrors: formatAdminFieldErrors(parsed.error),
      };
    }

    const res = await updateCompanyForAdmin(companyId, parsed.data);
    if (!res.ok) {
      if (res.code === "NOT_FOUND") return { ok: false, error: "Biznesi nuk u gjet." };
      if (res.code === "DUPLICATE_NUI") {
        return { ok: false, error: "Ky NUI ekziston tashmë.", fieldErrors: { fiscalNumber: ["NUI duhet të jetë unik."] } };
      }
      if (res.code === "DUPLICATE_NRB") {
        return {
          ok: false,
          error: "Ky NRB ekziston tashmë.",
          fieldErrors: { businessRegistrationNumber: ["NRB duhet të jetë unik."] },
        };
      }
      if (res.code === "DUPLICATE_SLUG") {
        return {
          ok: false,
          error: "Ky slug ekziston tashmë.",
          fieldErrors: { slug: ["Zgjidhni një slug tjetër për domain-in e klientit."] },
        };
      }
      if (res.code === "DUPLICATE_DOMAIN") {
        return {
          ok: false,
          error: "Ky domain ekziston tashmë.",
          fieldErrors: { customDomain: ["Domain duhet të jetë unik."] },
        };
      }
      return { ok: false, error: "Ruajtja dështoi." };
    }

    revalidateBizneset(companyId);
    return { ok: true };
  } catch (err) {
    console.error("[updateCompanyAction] unexpected:", err);
    return { ok: false, error: "Ruajtja dështoi papritur." };
  }
}

const setStatusSchema = z.object({
  companyId: z.string().min(1),
  status: companyStatusSchema,
});

export async function setCompanyStatusAction(raw: unknown): Promise<AdminActionResult> {
  try {
    if (!(await requireAdmin())) return { ok: false, error: NOT_AUTHORIZED };

    const parsed = setStatusSchema.safeParse(raw);
    if (!parsed.success) return { ok: false, error: "Të dhëna të pavlefshme." };

    const ok = await setCompanyStatusForAdmin(parsed.data.companyId, parsed.data.status);
    if (!ok) return { ok: false, error: "Biznesi nuk u gjet." };

    revalidateBizneset(parsed.data.companyId);
    return { ok: true };
  } catch (err) {
    console.error("[setCompanyStatusAction] unexpected:", err);
    return { ok: false, error: "Ndryshimi i statusit dështoi papritur." };
  }
}

export async function createCompanyUserAction(
  raw: unknown,
): Promise<AdminActionResult<{ tempPassword: string | null; attachedExisting: boolean }>> {
  try {
    if (!(await requireAdmin())) return { ok: false, error: NOT_AUTHORIZED };

    const body = raw as { companyId?: string; payload?: unknown };
    const companyId = typeof body.companyId === "string" ? body.companyId : "";
    if (!companyId) return { ok: false, error: "ID e biznesit mungon." };

    const parsed = createCompanyUserSchema.safeParse(body.payload ?? {});
    if (!parsed.success) {
      return {
        ok: false,
        error: "Ju lutem korrigjoni fushat e theksuara.",
        fieldErrors: formatAdminFieldErrors(parsed.error),
      };
    }

    const res = await createCompanyUserForAdmin(companyId, parsed.data);
    if (!res.ok) {
      if (res.code === "COMPANY_NOT_FOUND") return { ok: false, error: "Biznesi nuk u gjet." };
      if (res.code === "ALREADY_MEMBER") {
        return {
          ok: false,
          error: "Ky përdorues ka qasje tashmë në këtë biznes.",
          fieldErrors: { email: ["Përdoruesi është anëtar i këtij biznesi."] },
        };
      }
      if (res.code === "DUPLICATE_OWNER") {
        return {
          ok: false,
          error: "Ky biznes ka tashmë një pronar (OWNER). Zgjidhni një rol tjetër.",
          fieldErrors: { role: ["Vetëm një OWNER lejohet për biznes."] },
        };
      }
      return { ok: false, error: "Krijimi i përdoruesit dështoi." };
    }

    revalidateBizneset(companyId);
    return { ok: true, data: { tempPassword: res.tempPassword, attachedExisting: res.attachedExisting } };
  } catch (err) {
    console.error("[createCompanyUserAction] unexpected:", err);
    return { ok: false, error: "Krijimi i përdoruesit dështoi papritur." };
  }
}

const resetPasswordSchema = z.object({
  companyId: z.string().min(1),
  userId: z.string().min(1),
});

export async function resetUserPasswordAction(
  raw: unknown,
): Promise<AdminActionResult<{ tempPassword: string }>> {
  try {
    if (!(await requireAdmin())) return { ok: false, error: NOT_AUTHORIZED };

    const parsed = resetPasswordSchema.safeParse(raw);
    if (!parsed.success) return { ok: false, error: "Të dhëna të pavlefshme." };

    const res = await resetUserPasswordForAdmin(parsed.data.userId);
    if (!res.ok) {
      if (res.code === "NOT_FOUND") return { ok: false, error: "Përdoruesi nuk u gjet." };
      return { ok: false, error: "Rivendosja e fjalëkalimit dështoi." };
    }

    revalidateBizneset(parsed.data.companyId);
    return { ok: true, data: { tempPassword: res.tempPassword } };
  } catch (err) {
    console.error("[resetUserPasswordAction] unexpected:", err);
    return { ok: false, error: "Rivendosja e fjalëkalimit dështoi papritur." };
  }
}

const setMembershipActiveSchema = z.object({
  companyId: z.string().min(1),
  membershipId: z.string().min(1),
  isActive: z.boolean(),
});

export async function setMembershipActiveAction(raw: unknown): Promise<AdminActionResult> {
  try {
    if (!(await requireAdmin())) return { ok: false, error: NOT_AUTHORIZED };

    const parsed = setMembershipActiveSchema.safeParse(raw);
    if (!parsed.success) return { ok: false, error: "Të dhëna të pavlefshme." };

    const ok = await setMembershipActiveForAdmin(parsed.data.membershipId, parsed.data.isActive);
    if (!ok) return { ok: false, error: "Anëtarësia nuk u gjet." };

    revalidateBizneset(parsed.data.companyId);
    return { ok: true };
  } catch (err) {
    console.error("[setMembershipActiveAction] unexpected:", err);
    return { ok: false, error: "Ndryshimi i qasjes dështoi papritur." };
  }
}
