import { prisma } from "@/lib/prisma";
import { companySlugFromName } from "@/lib/company-url";
import { generateTempPassword, hashPassword } from "@/modules/auth/services/password";
import { destroyAllSessionsForUser } from "@/modules/auth/services/session";
import type { CompanyUpsertInput, CreateCompanyUserInput } from "@/modules/admin/validation/admin-schemas";
import { tenantUrlForCompany } from "@/server/tenant-domain";

// ---------------------------------------------------------------------------
// Companies
// ---------------------------------------------------------------------------

export interface AdminCompanyListItem {
  id: string;
  legalName: string;
  tradeName: string | null;
  slug: string | null;
  customDomain: string | null;
  tenantUrl: string | null;
  fiscalNumber: string | null;
  businessRegistrationNumber: string | null;
  email: string | null;
  status: "ACTIVE" | "SUSPENDED" | "ARCHIVED";
  userCount: number;
  createdAt: string;
}

export async function listCompaniesForAdmin(): Promise<AdminCompanyListItem[]> {
  const rows = await prisma.company.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      legalName: true,
      tradeName: true,
      slug: true,
      customDomain: true,
      fiscalNumber: true,
      businessRegistrationNumber: true,
      email: true,
      status: true,
      createdAt: true,
      _count: { select: { memberships: true } },
    },
  });

  return rows.map((r) => ({
    id: r.id,
    legalName: r.legalName,
    tradeName: r.tradeName,
    slug: r.slug,
    customDomain: r.customDomain,
    tenantUrl: tenantUrlForCompany({ slug: r.slug, customDomain: r.customDomain }),
    fiscalNumber: r.fiscalNumber,
    businessRegistrationNumber: r.businessRegistrationNumber,
    email: r.email,
    status: r.status,
    userCount: r._count.memberships,
    createdAt: r.createdAt.toISOString(),
  }));
}

export interface AdminCompanyUser {
  membershipId: string;
  userId: string;
  email: string;
  displayName: string | null;
  role: "OWNER" | "ADMIN" | "HR_MANAGER" | "ACCOUNTANT" | "READ_ONLY";
  membershipActive: boolean;
  userStatus: "INVITED" | "ACTIVE" | "DISABLED";
  lastLoginAt: string | null;
  createdAt: string;
}

export interface AdminCompanyDetail {
  id: string;
  legalName: string;
  tradeName: string | null;
  slug: string | null;
  customDomain: string | null;
  tenantUrl: string | null;
  fiscalNumber: string | null;
  businessRegistrationNumber: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  addressLine: string | null;
  city: string | null;
  postalCode: string | null;
  status: "ACTIVE" | "SUSPENDED" | "ARCHIVED";
  createdAt: string;
  users: AdminCompanyUser[];
}

export async function getCompanyDetailForAdmin(companyId: string): Promise<AdminCompanyDetail | null> {
  const row = await prisma.company.findUnique({
    where: { id: companyId },
    select: {
      id: true,
      legalName: true,
      tradeName: true,
      slug: true,
      customDomain: true,
      fiscalNumber: true,
      businessRegistrationNumber: true,
      email: true,
      phone: true,
      website: true,
      addressLine: true,
      city: true,
      postalCode: true,
      status: true,
      createdAt: true,
      memberships: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          role: true,
          isActive: true,
          createdAt: true,
          user: {
            select: { id: true, email: true, displayName: true, status: true, lastLoginAt: true },
          },
        },
      },
    },
  });

  if (!row) return null;

  return {
    id: row.id,
    legalName: row.legalName,
    tradeName: row.tradeName,
    slug: row.slug,
    customDomain: row.customDomain,
    tenantUrl: tenantUrlForCompany({ slug: row.slug, customDomain: row.customDomain }),
    fiscalNumber: row.fiscalNumber,
    businessRegistrationNumber: row.businessRegistrationNumber,
    email: row.email,
    phone: row.phone,
    website: row.website,
    addressLine: row.addressLine,
    city: row.city,
    postalCode: row.postalCode,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
    users: row.memberships.map((m) => ({
      membershipId: m.id,
      userId: m.user.id,
      email: m.user.email,
      displayName: m.user.displayName,
      role: m.role,
      membershipActive: m.isActive,
      userStatus: m.user.status,
      lastLoginAt: m.user.lastLoginAt?.toISOString() ?? null,
      createdAt: m.createdAt.toISOString(),
    })),
  };
}

export type UpdateCompanyResult =
  | { ok: true }
  | {
      ok: false;
      code: "NOT_FOUND" | "DUPLICATE_NUI" | "DUPLICATE_NRB" | "DUPLICATE_SLUG" | "DUPLICATE_DOMAIN" | "DB_ERROR";
      message?: string;
    };

async function generateUniqueCompanySlug(baseName: string, excludeCompanyId: string): Promise<string> {
  const base = companySlugFromName(baseName);
  for (let i = 0; i < 100; i += 1) {
    const suffix = i === 0 ? "" : `-${i + 1}`;
    const candidate = `${base.slice(0, 80 - suffix.length)}${suffix}`;
    const exists = await prisma.company.findFirst({
      where: { slug: candidate, id: { not: excludeCompanyId } },
      select: { id: true },
    });
    if (!exists) return candidate;
  }
  return `${base.slice(0, 67)}-${Date.now().toString(36)}`;
}

export async function updateCompanyForAdmin(
  companyId: string,
  input: CompanyUpsertInput,
): Promise<UpdateCompanyResult> {
  try {
    const slug = input.slug ?? (await generateUniqueCompanySlug(input.tradeName ?? input.legalName, companyId));
    await prisma.company.update({
      where: { id: companyId },
      data: {
        legalName: input.legalName,
        tradeName: input.tradeName ?? null,
        slug,
        customDomain: input.customDomain ?? null,
        fiscalNumber: input.fiscalNumber ?? null,
        businessRegistrationNumber: input.businessRegistrationNumber ?? null,
        email: input.email ?? null,
        phone: input.phone ?? null,
        website: input.website ?? null,
        addressLine: input.addressLine ?? null,
        city: input.city ?? null,
        postalCode: input.postalCode ?? null,
      },
    });
    return { ok: true };
  } catch (err) {
    const code = (err as { code?: string })?.code;
    if (code === "P2025") return { ok: false, code: "NOT_FOUND" };
    if (code === "P2002") {
      const meta = (err as { meta?: { target?: string[] | string } })?.meta;
      const target = Array.isArray(meta?.target) ? meta.target.join(",") : String(meta?.target ?? "");
      if (target.includes("fiscalNumber")) return { ok: false, code: "DUPLICATE_NUI" };
      if (target.includes("businessRegistrationNumber")) return { ok: false, code: "DUPLICATE_NRB" };
      if (target.includes("slug")) return { ok: false, code: "DUPLICATE_SLUG" };
      if (target.includes("customDomain")) return { ok: false, code: "DUPLICATE_DOMAIN" };
    }
    return { ok: false, code: "DB_ERROR", message: err instanceof Error ? err.message : String(err) };
  }
}

export async function setCompanyStatusForAdmin(
  companyId: string,
  status: "ACTIVE" | "SUSPENDED" | "ARCHIVED",
): Promise<boolean> {
  const res = await prisma.company.updateMany({ where: { id: companyId }, data: { status } });
  return res.count > 0;
}

// ---------------------------------------------------------------------------
// Company users (provisioned by the platform admin, temp-password flow)
// ---------------------------------------------------------------------------

export type CreateCompanyUserResult =
  | { ok: true; userId: string; tempPassword: string | null; attachedExisting: boolean }
  | { ok: false; code: "COMPANY_NOT_FOUND" | "ALREADY_MEMBER" | "DUPLICATE_OWNER" | "DB_ERROR"; message?: string };

/**
 * Provisions a login account for a company:
 * - new email → creates the User with a temp password (must rotate on first login) + membership
 * - existing email → only attaches a membership (their password stays untouched)
 */
export async function createCompanyUserForAdmin(
  companyId: string,
  input: CreateCompanyUserInput,
): Promise<CreateCompanyUserResult> {
  const company = await prisma.company.findUnique({ where: { id: companyId }, select: { id: true } });
  if (!company) return { ok: false, code: "COMPANY_NOT_FOUND" };

  const existing = await prisma.user.findUnique({
    where: { email: input.email },
    select: { id: true, memberships: { where: { companyId }, select: { id: true } } },
  });

  try {
    if (existing) {
      if (existing.memberships.length > 0) return { ok: false, code: "ALREADY_MEMBER" };
      await prisma.userCompanyMembership.create({
        data: {
          userId: existing.id,
          companyId,
          role: input.role,
          isActive: true,
          invitedAt: new Date(),
          acceptedAt: new Date(),
        },
      });
      return { ok: true, userId: existing.id, tempPassword: null, attachedExisting: true };
    }

    const tempPassword = generateTempPassword();
    const passwordHash = await hashPassword(tempPassword);

    const user = await prisma.user.create({
      data: {
        email: input.email,
        displayName: input.displayName ?? null,
        status: "ACTIVE",
        passwordHash,
        mustChangePassword: true,
        memberships: {
          create: {
            companyId,
            role: input.role,
            isActive: true,
            invitedAt: new Date(),
            acceptedAt: new Date(),
          },
        },
      },
      select: { id: true },
    });

    return { ok: true, userId: user.id, tempPassword, attachedExisting: false };
  } catch (err) {
    if ((err as { code?: string })?.code === "P2002") {
      // One-OWNER-per-company unique index
      return { ok: false, code: "DUPLICATE_OWNER" };
    }
    return { ok: false, code: "DB_ERROR", message: err instanceof Error ? err.message : String(err) };
  }
}

export type ResetPasswordResult =
  | { ok: true; tempPassword: string }
  | { ok: false; code: "NOT_FOUND" | "DB_ERROR"; message?: string };

/** Issues a fresh temp password and invalidates every session of the user. */
export async function resetUserPasswordForAdmin(userId: string): Promise<ResetPasswordResult> {
  try {
    const tempPassword = generateTempPassword();
    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash: await hashPassword(tempPassword), mustChangePassword: true },
    });
    await destroyAllSessionsForUser(userId);
    return { ok: true, tempPassword };
  } catch (err) {
    if ((err as { code?: string })?.code === "P2025") return { ok: false, code: "NOT_FOUND" };
    return { ok: false, code: "DB_ERROR", message: err instanceof Error ? err.message : String(err) };
  }
}

/** Toggles a user's access to one company; ends their sessions when revoking. */
export async function setMembershipActiveForAdmin(membershipId: string, isActive: boolean): Promise<boolean> {
  const membership = await prisma.userCompanyMembership.findUnique({
    where: { id: membershipId },
    select: { userId: true },
  });
  if (!membership) return false;

  await prisma.userCompanyMembership.update({
    where: { id: membershipId },
    data: { isActive },
  });

  if (!isActive) {
    await destroyAllSessionsForUser(membership.userId);
  }
  return true;
}
