"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireCapability } from "@/server/company-context";
import { setMembershipSalaryAccess } from "@/modules/admin/services/admin-service";

/**
 * Tenant-side user visibility management — the small self-serve slice of what
 * the platform admin console does. Deliberately narrow: an OWNER/ADMIN can
 * change a member's salary-visibility tier, and NOTHING else. Roles, user
 * creation and deactivation stay with the platform admin, so a client cannot
 * lock themselves out or mint owners.
 */

export type CompanyUsersActionResult<T = undefined> =
  | { ok: true; data?: T }
  | { ok: false; error: string };

export interface CompanyMemberRow {
  membershipId: string;
  userId: string;
  email: string;
  displayName: string | null;
  role: "OWNER" | "ADMIN" | "HR_MANAGER" | "ACCOUNTANT" | "READ_ONLY";
  salaryAccess: "FULL" | "STANDARD" | "NONE";
  isActive: boolean;
  isSelf: boolean;
}

export async function listCompanyMembersAction(): Promise<
  CompanyUsersActionResult<CompanyMemberRow[]>
> {
  const ctx = await requireCapability("company.settings");
  if (!ctx.ok) return { ok: false, error: ctx.error };
  const { companyId, user } = ctx.context;

  const rows = await prisma.userCompanyMembership.findMany({
    where: { companyId },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      userId: true,
      role: true,
      salaryAccess: true,
      isActive: true,
      user: { select: { email: true, displayName: true } },
    },
  });

  return {
    ok: true,
    data: rows.map((m) => ({
      membershipId: m.id,
      userId: m.userId,
      email: m.user.email,
      displayName: m.user.displayName,
      role: m.role,
      salaryAccess: m.salaryAccess,
      isActive: m.isActive,
      isSelf: m.userId === user.id,
    })),
  };
}

const setSalaryAccessSchema = z.object({
  membershipId: z.string().min(1),
  salaryAccess: z.enum(["FULL", "STANDARD", "NONE"]),
});

export async function setMemberSalaryAccessAction(
  raw: unknown,
): Promise<CompanyUsersActionResult> {
  const ctx = await requireCapability("company.settings");
  if (!ctx.ok) return { ok: false, error: ctx.error };
  const { companyId, user } = ctx.context;

  const parsed = setSalaryAccessSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Të dhënat nuk janë valide." };

  // Tenant scoping: the membership must belong to THIS company — the id alone
  // is client input and could name any tenant's row.
  const target = await prisma.userCompanyMembership.findFirst({
    where: { id: parsed.data.membershipId, companyId },
    select: { userId: true },
  });
  if (!target) return { ok: false, error: "Anëtarësia nuk u gjet." };

  // Nobody widens (or performatively narrows) their own salary visibility —
  // the tier is something set ABOUT you, by someone else.
  if (target.userId === user.id) {
    return { ok: false, error: "Nuk mund të ndryshoni qasjen tuaj në paga." };
  }

  const ok = await setMembershipSalaryAccess(parsed.data.membershipId, parsed.data.salaryAccess);
  if (!ok) return { ok: false, error: "Ndryshimi dështoi." };

  try {
    revalidatePath("/konfigurime");
  } catch {
    /* ignore */
  }
  return { ok: true };
}
