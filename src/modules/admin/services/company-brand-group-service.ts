import { prisma } from "@/lib/prisma";
import { createCompanyUserForAdmin } from "@/modules/admin/services/admin-service";
import type { CreateCompanyUserInput } from "@/modules/admin/validation/admin-schemas";

/**
 * Brand groups — several legal entities (one Company per NUI/NRB) under one commercial brand.
 *
 * This is an admin-console organising layer only. It never widens the tenant boundary:
 * every query in the app stays scoped to a single companyId, and a user's access still
 * comes from UserCompanyMembership — one row per company, never inherited from the group.
 */

export interface AdminBrandGroupListItem {
  id: string;
  name: string;
  companyCount: number;
}

export async function listBrandGroupsForAdmin(): Promise<AdminBrandGroupListItem[]> {
  const rows = await prisma.companyBrandGroup.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true, _count: { select: { companies: true } } },
  });
  return rows.map((r) => ({ id: r.id, name: r.name, companyCount: r._count.companies }));
}

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
