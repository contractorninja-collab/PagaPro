import { cache } from "react";
import { redirect } from "next/navigation";
import { NextResponse } from "next/server";
import type { CompanyMembershipRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, type SessionUser } from "@/modules/auth/services/session";
import { resolveActiveCompanyId } from "@/server/company-scope";

export type CompanyContextFailure =
  | "UNAUTHENTICATED"
  | "PASSWORD_CHANGE_REQUIRED"
  | "NO_ACTIVE_COMPANY"
  | "FORBIDDEN";

export interface CompanyContext {
  user: SessionUser;
  companyId: string;
  /** Membership role in the active company; null for platform admins acting without a membership. */
  role: CompanyMembershipRole | null;
}

export type CompanyContextResult =
  | { ok: true; context: CompanyContext }
  | { ok: false; reason: CompanyContextFailure };

/**
 * Authoritative per-request tenant context: validates the DB-backed session,
 * resolves the active company, and verifies membership (platform admins may
 * enter any existing company). Server actions and API routes must gate on
 * this instead of `resolveActiveCompanyId()` — the tenant cookie alone is
 * client-controlled input.
 */
export const getCompanyContext = cache(async (): Promise<CompanyContextResult> => {
  const user = await getCurrentUser();
  if (!user) return { ok: false, reason: "UNAUTHENTICATED" };
  if (user.mustChangePassword) return { ok: false, reason: "PASSWORD_CHANGE_REQUIRED" };

  const companyId = await resolveActiveCompanyId();
  if (!companyId) return { ok: false, reason: "NO_ACTIVE_COMPANY" };

  const membership = await prisma.userCompanyMembership.findUnique({
    where: { userId_companyId: { userId: user.id, companyId } },
    select: { isActive: true, role: true, company: { select: { status: true } } },
  });

  if (membership?.isActive && membership.company.status === "ACTIVE") {
    return { ok: true, context: { user, companyId, role: membership.role } };
  }

  // Platform admins may enter any existing company (including suspended/archived
  // tenants) for support; members are bound to their company's status, matching
  // loginAction and /auth/kompani which both require an ACTIVE company.
  if (user.isPlatformAdmin) {
    const company = await prisma.company.findUnique({
      where: { id: companyId },
      select: { id: true },
    });
    if (!company) return { ok: false, reason: "NO_ACTIVE_COMPANY" };
    return { ok: true, context: { user, companyId, role: membership?.role ?? null } };
  }

  return { ok: false, reason: "FORBIDDEN" };
});

const FAILURE_MESSAGE_SQ: Record<CompanyContextFailure, string> = {
  UNAUTHENTICATED: "Sesioni juaj ka skaduar. Kyçuni përsëri.",
  PASSWORD_CHANGE_REQUIRED: "Duhet të ndryshoni fjalëkalimin para se të vazhdoni.",
  NO_ACTIVE_COMPANY: "Nuk ka kompani aktive.",
  FORBIDDEN: "Nuk keni qasje në këtë kompani.",
};

/** Albanian user-facing message for a context failure (for server-action results). */
export function companyContextErrorMessage(reason: CompanyContextFailure): string {
  return FAILURE_MESSAGE_SQ[reason];
}

/** JSON error response for a context failure (for API route handlers). */
export function companyContextHttpError(reason: CompanyContextFailure): NextResponse {
  const status = reason === "UNAUTHENTICATED" ? 401 : 403;
  return NextResponse.json(
    { error: status === 401 ? "Unauthorized" : "Forbidden" },
    { status },
  );
}

/**
 * Page/RSC variant: redirects on failure (mirrors the dashboard layout's
 * semantics) and returns the verified context. Layouts do not re-run on
 * client-side navigations, so pages must gate their own data fetching.
 */
export async function requireCompanyContextPage(): Promise<CompanyContext> {
  const result = await getCompanyContext();
  if (result.ok) return result.context;

  switch (result.reason) {
    case "UNAUTHENTICATED":
      redirect("/hyrje");
    case "PASSWORD_CHANGE_REQUIRED":
      redirect("/ndrysho-fjalekalimin");
    case "NO_ACTIVE_COMPANY": {
      const user = await getCurrentUser();
      redirect(user?.isPlatformAdmin ? "/admin" : "/auth/kompani");
    }
    case "FORBIDDEN":
      redirect("/auth/kompani");
  }
}
