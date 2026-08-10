import { prisma } from "@/lib/prisma";
import { createCompanyUserForAdmin } from "@/modules/admin/services/admin-service";
import type { CreateCompanyUserInput } from "@/modules/admin/validation/admin-schemas";

/**
 * Brand groups — several legal entities (one Company per NUI) under one commercial brand.
 *
 * This is an admin-console organising layer only. It never widens the tenant boundary:
 * every query in the app stays scoped to a single companyId, and a user's access still
 * comes from UserCompanyMembership — one row per company, never inherited from the group.
 */

export async function createBrandGroup(name: string): Promise<{ id: string; name: string }> {
  return prisma.companyBrandGroup.create({
    data: { name: name.trim() },
    select: { id: true, name: true },
  });
}

/** `null` ungroups the company. */
export async function setCompanyBrandGroup(
  companyId: string,
  brandGroupId: string | null,
): Promise<boolean> {
  const res = await prisma.company.updateMany({
    where: { id: companyId },
    data: { brandGroupId },
  });
  return res.count > 0;
}

export interface UngroupedCompanyOption {
  id: string;
  legalName: string;
  tradeName: string | null;
}

/**
 * Companies that belong to no brand group yet — the candidates for "Shto
 * ekzistuese" in the group tab strip. Exists because a company created before
 * grouping (or through the plain "Shto Biznes" flow) would otherwise be
 * permanently stranded outside its brand: the form-level group picker was
 * removed on purpose, so adoption from the mother company's page is the only
 * remaining door in.
 */
export async function listUngroupedCompaniesForAdmin(
  excludeCompanyId: string,
): Promise<UngroupedCompanyOption[]> {
  return prisma.company.findMany({
    where: { brandGroupId: null, id: { not: excludeCompanyId }, status: { not: "ARCHIVED" } },
    orderBy: { legalName: "asc" },
    select: { id: true, legalName: true, tradeName: true },
  });
}

export interface BrandGroupSibling {
  id: string;
  legalName: string;
  tradeName: string | null;
  fiscalNumber: string | null;
  status: "ACTIVE" | "SUSPENDED" | "ARCHIVED";
}

/** The other companies sharing a company's brand group — empty when ungrouped. */
export async function listBrandGroupSiblings(companyId: string): Promise<BrandGroupSibling[]> {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { brandGroupId: true },
  });
  if (!company?.brandGroupId) return [];

  return prisma.company.findMany({
    where: { brandGroupId: company.brandGroupId, id: { not: companyId } },
    orderBy: { legalName: "asc" },
    select: { id: true, legalName: true, tradeName: true, fiscalNumber: true, status: true },
  });
}

export type CopyMembershipsResult =
  | { ok: true; copied: number }
  | { ok: false; code: "SOURCE_NOT_FOUND" | "NOT_SAME_GROUP" };

/**
 * Carries a company's current active users over to a brand-new sibling.
 *
 * This is what makes "+ Kompani e Re" a complete action: without it, a freshly
 * created company would have zero memberships, so the customer who already
 * manages the rest of the group couldn't see it — the dashboard switcher only
 * ever lists companies the logged-in user has a membership row on, and nothing
 * grants one automatically just because two companies share a brand group.
 *
 * Only ACTIVE memberships are copied (a disabled one shouldn't come back to
 * life on a new company), and a user who somehow already has a row on the
 * target is skipped rather than erroring — this only ever runs right after
 * `provisionCompany`, so that shouldn't happen, but it costs nothing to be safe.
 */
export async function copyCompanyMemberships(
  fromCompanyId: string,
  toCompanyId: string,
): Promise<CopyMembershipsResult> {
  const [from, to] = await Promise.all([
    prisma.company.findUnique({ where: { id: fromCompanyId }, select: { brandGroupId: true } }),
    prisma.company.findUnique({ where: { id: toCompanyId }, select: { brandGroupId: true } }),
  ]);
  if (!from) return { ok: false, code: "SOURCE_NOT_FOUND" };
  if (!from.brandGroupId || from.brandGroupId !== to?.brandGroupId) {
    return { ok: false, code: "NOT_SAME_GROUP" };
  }

  const sourceMemberships = await prisma.userCompanyMembership.findMany({
    where: { companyId: fromCompanyId, isActive: true },
    select: { userId: true, role: true },
  });

  let copied = 0;
  for (const m of sourceMemberships) {
    const existing = await prisma.userCompanyMembership.findUnique({
      where: { userId_companyId: { userId: m.userId, companyId: toCompanyId } },
      select: { id: true },
    });
    if (existing) continue;

    await prisma.userCompanyMembership.create({
      data: {
        userId: m.userId,
        companyId: toCompanyId,
        role: m.role,
        isActive: true,
        invitedAt: new Date(),
        acceptedAt: new Date(),
      },
    });
    copied += 1;
  }

  return { ok: true, copied };
}

/**
 * Heals every company in a brand group that has no users at all, copying the
 * union of the group's ACTIVE memberships into it (first-seen role per user).
 *
 * Exists for companies created in the window before sibling creation started
 * copying memberships automatically — they sit invisible to the customer,
 * because the dashboard switcher only lists companies with a real membership
 * row. Group-wide on purpose: the admin fixes the whole brand by opening any
 * one of its companies, without knowing which sibling is the broken one.
 *
 * The zero-membership guard is what makes this safe to run on every admin
 * page view: a company where an admin deliberately removed someone still has
 * other members, so it never qualifies and the removal is never undone.
 */
export async function backfillCompanyMembershipsFromGroup(companyId: string): Promise<number> {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { brandGroupId: true },
  });
  if (!company?.brandGroupId) return 0;

  const groupCompanies = await prisma.company.findMany({
    where: { brandGroupId: company.brandGroupId },
    select: { id: true, _count: { select: { memberships: true } } },
  });
  const empty = groupCompanies.filter((c) => c._count.memberships === 0);
  if (empty.length === 0) return 0;

  const groupMemberships = await prisma.userCompanyMembership.findMany({
    where: { isActive: true, company: { brandGroupId: company.brandGroupId } },
    orderBy: { createdAt: "asc" },
    select: { userId: true, role: true },
  });

  const byUser = new Map<string, (typeof groupMemberships)[number]["role"]>();
  for (const m of groupMemberships) {
    if (!byUser.has(m.userId)) byUser.set(m.userId, m.role);
  }
  if (byUser.size === 0) return 0;

  let copied = 0;
  for (const target of empty) {
    for (const [userId, role] of byUser) {
      await prisma.userCompanyMembership.create({
        data: {
          userId,
          companyId: target.id,
          role,
          isActive: true,
          invitedAt: new Date(),
          acceptedAt: new Date(),
        },
      });
      copied += 1;
    }
  }

  return copied;
}

export interface BrandGroupAttachOutcome {
  companyId: string;
  companyName: string;
  /** "created" only ever happens once — the first company creates the User. */
  outcome: "created" | "attached" | "already_member" | "duplicate_owner" | "failed";
}

export type AddUserToBrandGroupResult =
  | {
      ok: true;
      /** Non-null only when the email was new and a User had to be created. */
      tempPassword: string | null;
      results: BrandGroupAttachOutcome[];
    }
  | { ok: false; code: "GROUP_NOT_FOUND" | "NO_COMPANIES" };

/**
 * Gives one person access to every company in a brand group — the actual
 * "enable multi-company for this customer" step.
 *
 * Delegates to `createCompanyUserForAdmin` per company rather than reimplementing it, so
 * the new-user-vs-existing-user split, the temp-password flow and the one-OWNER-per-company
 * constraint all behave identically to adding a user to a single company. Per-company
 * failures are reported, never fatal: one company already having an OWNER must not stop the
 * user being attached to the rest.
 */
export async function addUserToBrandGroupCompanies(
  brandGroupId: string,
  input: CreateCompanyUserInput,
): Promise<AddUserToBrandGroupResult> {
  const group = await prisma.companyBrandGroup.findUnique({
    where: { id: brandGroupId },
    select: { id: true },
  });
  if (!group) return { ok: false, code: "GROUP_NOT_FOUND" };

  const companies = await prisma.company.findMany({
    where: { brandGroupId },
    orderBy: { legalName: "asc" },
    select: { id: true, legalName: true, tradeName: true },
  });
  if (companies.length === 0) return { ok: false, code: "NO_COMPANIES" };

  const results: BrandGroupAttachOutcome[] = [];
  let tempPassword: string | null = null;

  for (const company of companies) {
    const res = await createCompanyUserForAdmin(company.id, input);
    const companyName = company.tradeName?.trim() || company.legalName;

    if (res.ok) {
      // Only the first company can create the User; the rest attach memberships.
      if (res.tempPassword) tempPassword = res.tempPassword;
      results.push({
        companyId: company.id,
        companyName,
        outcome: res.attachedExisting ? "attached" : "created",
      });
      continue;
    }

    results.push({
      companyId: company.id,
      companyName,
      outcome:
        res.code === "ALREADY_MEMBER"
          ? "already_member"
          : res.code === "DUPLICATE_OWNER"
            ? "duplicate_owner"
            : "failed",
    });
  }

  return { ok: true, tempPassword, results };
}
