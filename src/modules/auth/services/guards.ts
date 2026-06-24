import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, type SessionUser } from "@/modules/auth/services/session";

/** Requires a logged-in ACTIVE user; otherwise redirects to the login page. */
export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/hyrje");
  if (user.mustChangePassword) redirect("/ndrysho-fjalekalimin");
  return user;
}

/** Requires a platform super-admin (backstage console access). */
export async function requirePlatformAdmin(): Promise<SessionUser> {
  const user = await requireUser();
  if (!user.isPlatformAdmin) redirect("/paneli");
  return user;
}

/**
 * Requires a logged-in user authorized for the given company.
 * Platform admins may enter any company; customers need an active membership.
 */
export async function requireCompanyUser(companyId: string): Promise<SessionUser> {
  const user = await requireUser();
  if (user.isPlatformAdmin) return user;

  const membership = await prisma.userCompanyMembership.findUnique({
    where: { userId_companyId: { userId: user.id, companyId } },
    select: { isActive: true },
  });
  if (!membership?.isActive) redirect("/hyrje");
  return user;
}
