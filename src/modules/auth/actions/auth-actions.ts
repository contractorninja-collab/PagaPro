"use server";

import { cookies, headers } from "next/headers";
import { z } from "zod";
import { ADMIN_BASE_PATH } from "@/lib/admin-path";
import { prisma } from "@/lib/prisma";
import { hashPassword, verifyPassword } from "@/modules/auth/services/password";
import {
  isLoginThrottled,
  recordLoginAttempt,
  THROTTLED_MESSAGE,
} from "@/modules/auth/services/login-throttle";
import {
  createSession,
  destroyAllSessionsForUser,
  destroySession,
  getCurrentUser,
} from "@/modules/auth/services/session";
import { ACTIVE_COMPANY_COOKIE, resolveRequestCompanyIdFromHost } from "@/server/company-scope";

export type AuthActionResult =
  | { ok: true; redirectTo: string }
  | { ok: false; error: string };

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Email i pavlefshëm."),
  password: z.string().min(1, "Fjalëkalimi është i detyrueshëm."),
});

const INVALID_CREDENTIALS = "Email-i ose fjalëkalimi është i pasaktë.";

export async function loginAction(raw: unknown): Promise<AuthActionResult> {
  try {
    const parsed = loginSchema.safeParse(raw);
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? INVALID_CREDENTIALS };
    }
    const { email, password } = parsed.data;

    /**
     * Throttle before touching the password: five failures in fifteen minutes
     * ends the conversation, for existing and non-existing addresses alike —
     * differing behavior is exactly what an enumeration attack measures.
     */
    if (await isLoginThrottled(email)) {
      return { ok: false, error: THROTTLED_MESSAGE };
    }
    const ip =
      (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim()?.slice(0, 64) ?? null;

    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        status: true,
        passwordHash: true,
        isPlatformAdmin: true,
        mustChangePassword: true,
        memberships: {
          where: { isActive: true, company: { status: "ACTIVE" } },
          orderBy: { createdAt: "asc" },
          select: { companyId: true },
        },
      },
    });

    if (!user?.passwordHash) {
      await recordLoginAttempt({ email, ip, success: false });
      return { ok: false, error: INVALID_CREDENTIALS };
    }
    if (user.status === "DISABLED") {
      return { ok: false, error: "Llogaria juaj është çaktivizuar. Kontaktoni administratorin." };
    }

    const valid = await verifyPassword(password, user.passwordHash);
    if (!valid) {
      await recordLoginAttempt({ email, ip, success: false });
      return { ok: false, error: INVALID_CREDENTIALS };
    }
    await recordLoginAttempt({ email, ip, success: true });

    if (!user.isPlatformAdmin && user.memberships.length === 0) {
      return { ok: false, error: "Llogaria juaj nuk ka qasje në asnjë biznes aktiv." };
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date(), ...(user.status === "INVITED" ? { status: "ACTIVE" } : {}) },
    });

    const requestedCompanyId = await resolveRequestCompanyIdFromHost();
    if (requestedCompanyId && !user.isPlatformAdmin && !user.memberships.some((m) => m.companyId === requestedCompanyId)) {
      return { ok: false, error: "Llogaria juaj nuk ka qasje në këtë klient." };
    }

    await createSession(user.id);

    const jar = await cookies();
    const activeCompanyId = requestedCompanyId ?? user.memberships[0]?.companyId;
    if (activeCompanyId) {
      jar.set(ACTIVE_COMPANY_COOKIE, activeCompanyId, {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
      });
    }

    if (user.mustChangePassword) return { ok: true, redirectTo: "/ndrysho-fjalekalimin" };
    if (user.isPlatformAdmin && !requestedCompanyId) return { ok: true, redirectTo: ADMIN_BASE_PATH };
    return { ok: true, redirectTo: "/paneli" };
  } catch (err) {
    console.error("[loginAction] unexpected:", err);
    return { ok: false, error: "Hyrja dështoi papritur. Provoni përsëri." };
  }
}

/**
 * Switches which company the session is scoped to.
 *
 * Membership is re-checked here against the database — the submitted id is client input and
 * is never trusted, exactly as `getCompanyContext()` treats the cookie. Hiding a company
 * from the switcher menu is presentation, not access control.
 *
 * Returns a redirect target rather than revalidating in place: every page resolves its
 * companyId from this cookie, so switching without a full navigation would leave the old
 * company's data on screen while subsequent actions ran against the new one.
 */
export async function switchActiveCompanyAction(companyId: string): Promise<AuthActionResult> {
  try {
    const user = await getCurrentUser();
    if (!user) return { ok: false, error: "Sesioni ka skaduar. Hyni përsëri." };

    const id = typeof companyId === "string" ? companyId.trim() : "";
    if (!id) return { ok: false, error: "Kompania nuk u specifikua." };

    const membership = await prisma.userCompanyMembership.findUnique({
      where: { userId_companyId: { userId: user.id, companyId: id } },
      select: { isActive: true, company: { select: { status: true } } },
    });

    const allowed =
      (membership?.isActive && membership.company.status === "ACTIVE") || user.isPlatformAdmin;
    if (!allowed) return { ok: false, error: "Nuk keni qasje në këtë kompani." };

    const jar = await cookies();
    jar.set(ACTIVE_COMPANY_COOKIE, id, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
    });

    return { ok: true, redirectTo: "/paneli" };
  } catch (err) {
    console.error("[switchActiveCompanyAction] unexpected:", err);
    return { ok: false, error: "Ndërrimi i kompanisë dështoi." };
  }
}

export async function logoutAction(): Promise<void> {
  try {
    await destroySession();
    const jar = await cookies();
    jar.delete(ACTIVE_COMPANY_COOKIE);
  } catch (err) {
    console.error("[logoutAction] unexpected:", err);
  }
}

const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Fjalëkalimi aktual është i detyrueshëm."),
    newPassword: z
      .string()
      .min(10, "Fjalëkalimi i ri duhet të ketë të paktën 10 karaktere.")
      .max(128, "Fjalëkalimi i ri është shumë i gjatë."),
    confirmPassword: z.string(),
  })
  .refine((v) => v.newPassword === v.confirmPassword, {
    message: "Fjalëkalimet e reja nuk përputhen.",
    path: ["confirmPassword"],
  });

export async function changePasswordAction(raw: unknown): Promise<AuthActionResult> {
  try {
    const user = await getCurrentUser();
    if (!user) return { ok: false, error: "Sesioni ka skaduar. Hyni përsëri." };

    const parsed = changePasswordSchema.safeParse(raw);
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? "Të dhëna të pavlefshme." };
    }

    const row = await prisma.user.findUnique({
      where: { id: user.id },
      select: { passwordHash: true },
    });
    if (!row?.passwordHash) return { ok: false, error: "Llogaria nuk ka kredenciale të vendosura." };

    const valid = await verifyPassword(parsed.data.currentPassword, row.passwordHash);
    if (!valid) return { ok: false, error: "Fjalëkalimi aktual është i pasaktë." };

    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: await hashPassword(parsed.data.newPassword),
        mustChangePassword: false,
      },
    });

    await destroyAllSessionsForUser(user.id);
    await createSession(user.id);

    return { ok: true, redirectTo: user.isPlatformAdmin ? ADMIN_BASE_PATH : "/paneli" };
  } catch (err) {
    console.error("[changePasswordAction] unexpected:", err);
    return { ok: false, error: "Ndryshimi i fjalëkalimit dështoi papritur." };
  }
}
