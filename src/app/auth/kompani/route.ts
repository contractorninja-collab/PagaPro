import { NextResponse } from "next/server";
import { ADMIN_BASE_PATH } from "@/lib/admin-path";
import { prisma } from "@/lib/prisma";
import { destroySession, getCurrentUser } from "@/modules/auth/services/session";
import { ACTIVE_COMPANY_COOKIE, resolveRequestCompanyIdFromHost } from "@/server/company-scope";

/**
 * Re-resolves the active company for the logged-in user:
 * picks their first active membership, sets the tenant cookie, and returns to /paneli.
 * Used when the tenant cookie is missing or points to a company the user can't access.
 */
export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.redirect(new URL("/hyrje", request.url));
  }

  const hostCompanyId = await resolveRequestCompanyIdFromHost();
  if (hostCompanyId) {
    const membership = await prisma.userCompanyMembership.findUnique({
      where: { userId_companyId: { userId: user.id, companyId: hostCompanyId } },
      select: { isActive: true, company: { select: { status: true } } },
    });
    if (user.isPlatformAdmin || (membership?.isActive && membership.company.status === "ACTIVE")) {
      const res = NextResponse.redirect(new URL("/paneli", request.url));
      res.cookies.set(ACTIVE_COMPANY_COOKIE, hostCompanyId, {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
      });
      return res;
    }
  }

  const membership = await prisma.userCompanyMembership.findFirst({
    where: { userId: user.id, isActive: true, company: { status: "ACTIVE" } },
    orderBy: { createdAt: "asc" },
    select: { companyId: true },
  });

  if (!membership) {
    if (user.isPlatformAdmin) {
      return NextResponse.redirect(new URL(ADMIN_BASE_PATH, request.url));
    }
    // No accessible company left — end the session to avoid a login redirect loop.
    await destroySession();
    return NextResponse.redirect(new URL("/hyrje", request.url));
  }

  const res = NextResponse.redirect(new URL("/paneli", request.url));
  res.cookies.set(ACTIVE_COMPANY_COOKIE, membership.companyId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  });
  return res;
}
