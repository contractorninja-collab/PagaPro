"use server";

import { revalidatePath } from "next/cache";
import { adminPath } from "@/lib/admin-path";
import { z } from "zod";
import { getCurrentUser } from "@/modules/auth/services/session";
import { provisionCompany } from "@/modules/admin/services/company-provisioning";
import {
  createCompanyUserForAdmin,
  resetUserPasswordForAdmin,
  setCompanyStatusForAdmin,
  setCompanyTimeClockEnabledForAdmin,
  setMembershipActiveForAdmin,
  updateCompanyForAdmin,
} from "@/modules/admin/services/admin-service";
import {
  addUserToBrandGroupCompanies,
  createBrandGroup,
  setCompanyBrandGroup,
  type BrandGroupAttachOutcome,
} from "@/modules/admin/services/company-brand-group-service";
import {
  createTimeClockDevice,
  regenerateTimeClockPairingCode,
  setTimeClockDeviceActive,
} from "@/modules/timeclock/services/timeclock-device-service";
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
    revalidatePath(adminPath("bizneset"));
    if (companyId) revalidatePath(adminPath(`bizneset/${companyId}`));
  } catch (err) {
    console.error("[admin-actions] revalidatePath failed:", err);
  }
}

export async function createCompanyAction(
  raw: unknown,
): Promise<AdminActionResult<{ id: string; templatesSeeded: number; warnings: string[] }>> {
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
    return {
      ok: true,
      data: { id: res.id, templatesSeeded: res.templatesSeeded, warnings: res.warnings },
    };
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

// ---------------------------------------------------------------------------
// Brand groups — several legal entities under one commercial brand
// ---------------------------------------------------------------------------

const createBrandGroupSchema = z.object({
  name: z.string().trim().min(2, "Emri i grupit duhet të ketë të paktën 2 karaktere.").max(160),
});

export async function createBrandGroupAction(
  raw: unknown,
): Promise<AdminActionResult<{ id: string; name: string }>> {
  try {
    if (!(await requireAdmin())) return { ok: false, error: NOT_AUTHORIZED };

    const parsed = createBrandGroupSchema.safeParse(raw);
    if (!parsed.success) {
      return {
        ok: false,
        error: "Emri i grupit është i detyrueshëm.",
        fieldErrors: formatAdminFieldErrors(parsed.error),
      };
    }

    const group = await createBrandGroup(parsed.data.name);
    revalidateBizneset();
    return { ok: true, data: group };
  } catch (err) {
    console.error("[createBrandGroupAction] unexpected:", err);
    return { ok: false, error: "Krijimi i grupit dështoi." };
  }
}

const setCompanyBrandGroupSchema = z.object({
  companyId: z.string().min(1),
  /** `null` ungroups the company. */
  brandGroupId: z.string().min(1).nullable(),
});

export async function setCompanyBrandGroupAction(raw: unknown): Promise<AdminActionResult> {
  try {
    if (!(await requireAdmin())) return { ok: false, error: NOT_AUTHORIZED };

    const parsed = setCompanyBrandGroupSchema.safeParse(raw);
    if (!parsed.success) return { ok: false, error: "Të dhëna të pavlefshme." };

    const ok = await setCompanyBrandGroup(parsed.data.companyId, parsed.data.brandGroupId);
    if (!ok) return { ok: false, error: "Biznesi nuk u gjet." };

    revalidateBizneset(parsed.data.companyId);
    return { ok: true };
  } catch (err) {
    console.error("[setCompanyBrandGroupAction] unexpected:", err);
    return { ok: false, error: "Ndryshimi i grupit dështoi." };
  }
}

/**
 * Gives one login access to every company in a brand group — this is the
 * "enable multi-company for this customer" step. Per-company outcomes come back
 * individually so the UI can report a partial success honestly.
 */
export async function addUserToBrandGroupCompaniesAction(
  raw: unknown,
): Promise<AdminActionResult<{ tempPassword: string | null; results: BrandGroupAttachOutcome[] }>> {
  try {
    if (!(await requireAdmin())) return { ok: false, error: NOT_AUTHORIZED };

    const body = raw as { brandGroupId?: string; payload?: unknown };
    const brandGroupId = typeof body.brandGroupId === "string" ? body.brandGroupId : "";
    if (!brandGroupId) return { ok: false, error: "Grupi i kompanive mungon." };

    const parsed = createCompanyUserSchema.safeParse(body.payload ?? {});
    if (!parsed.success) {
      return {
        ok: false,
        error: "Ju lutem korrigjoni fushat e theksuara.",
        fieldErrors: formatAdminFieldErrors(parsed.error),
      };
    }

    const res = await addUserToBrandGroupCompanies(brandGroupId, parsed.data);
    if (!res.ok) {
      if (res.code === "GROUP_NOT_FOUND") return { ok: false, error: "Grupi nuk u gjet." };
      return { ok: false, error: "Ky grup nuk ka ende kompani." };
    }

    revalidateBizneset();
    for (const r of res.results) revalidateBizneset(r.companyId);
    return { ok: true, data: { tempPassword: res.tempPassword, results: res.results } };
  } catch (err) {
    console.error("[addUserToBrandGroupCompaniesAction] unexpected:", err);
    return { ok: false, error: "Shtimi i përdoruesit në grup dështoi." };
  }
}

// ---------------------------------------------------------------------------
// Badge time clock — entitlement and door devices
// ---------------------------------------------------------------------------

const setTimeClockSchema = z.object({
  companyId: z.string().min(1),
  enabled: z.boolean(),
});

export async function setCompanyTimeClockEnabledAction(raw: unknown): Promise<AdminActionResult> {
  try {
    if (!(await requireAdmin())) return { ok: false, error: NOT_AUTHORIZED };

    const parsed = setTimeClockSchema.safeParse(raw);
    if (!parsed.success) return { ok: false, error: "Të dhëna të pavlefshme." };

    const ok = await setCompanyTimeClockEnabledForAdmin(parsed.data.companyId, parsed.data.enabled);
    if (!ok) return { ok: false, error: "Biznesi nuk u gjet." };

    revalidateBizneset(parsed.data.companyId);
    return { ok: true };
  } catch (err) {
    console.error("[setCompanyTimeClockEnabledAction] unexpected:", err);
    return { ok: false, error: "Ndryshimi dështoi papritur." };
  }
}

const createDeviceSchema = z.object({
  companyId: z.string().min(1),
  label: z.string().min(1).max(80),
  location: z.string().max(120).optional(),
});

export async function createTimeClockDeviceAction(
  raw: unknown,
): Promise<AdminActionResult<{ pairingCode: string }>> {
  try {
    if (!(await requireAdmin())) return { ok: false, error: NOT_AUTHORIZED };

    const parsed = createDeviceSchema.safeParse(raw);
    if (!parsed.success) return { ok: false, error: "Emri i pajisjes është i detyrueshëm." };

    const user = await getCurrentUser();
    const res = await createTimeClockDevice({
      companyId: parsed.data.companyId,
      label: parsed.data.label,
      location: parsed.data.location,
      actorUserId: user?.id ?? null,
    });
    if (!res.ok) return { ok: false, error: res.error };

    revalidateBizneset(parsed.data.companyId);
    return { ok: true, data: { pairingCode: res.pairingCode } };
  } catch (err) {
    console.error("[createTimeClockDeviceAction] unexpected:", err);
    return { ok: false, error: "Krijimi i pajisjes dështoi." };
  }
}

const deviceRefSchema = z.object({
  companyId: z.string().min(1),
  deviceId: z.string().min(1),
});

export async function regenerateTimeClockPairingCodeAction(
  raw: unknown,
): Promise<AdminActionResult<{ pairingCode: string }>> {
  try {
    if (!(await requireAdmin())) return { ok: false, error: NOT_AUTHORIZED };

    const parsed = deviceRefSchema.safeParse(raw);
    if (!parsed.success) return { ok: false, error: "Të dhëna të pavlefshme." };

    const res = await regenerateTimeClockPairingCode(parsed.data.companyId, parsed.data.deviceId);
    if (!res.ok) return { ok: false, error: res.error };

    revalidateBizneset(parsed.data.companyId);
    return { ok: true, data: { pairingCode: res.pairingCode } };
  } catch (err) {
    console.error("[regenerateTimeClockPairingCodeAction] unexpected:", err);
    return { ok: false, error: "Gjenerimi i kodit dështoi." };
  }
}

export async function setTimeClockDeviceActiveAction(
  raw: unknown,
): Promise<AdminActionResult> {
  try {
    if (!(await requireAdmin())) return { ok: false, error: NOT_AUTHORIZED };

    const parsed = deviceRefSchema.extend({ isActive: z.boolean() }).safeParse(raw);
    if (!parsed.success) return { ok: false, error: "Të dhëna të pavlefshme." };

    const res = await setTimeClockDeviceActive(
      parsed.data.companyId,
      parsed.data.deviceId,
      parsed.data.isActive,
    );
    if (!res.ok) return { ok: false, error: res.error };

    revalidateBizneset(parsed.data.companyId);
    return { ok: true };
  } catch (err) {
    console.error("[setTimeClockDeviceActiveAction] unexpected:", err);
    return { ok: false, error: "Ndryshimi dështoi." };
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
