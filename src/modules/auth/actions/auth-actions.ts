"use server";

import { cookies } from "next/headers";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { hashPassword, verifyPassword } from "@/modules/auth/services/password";
import { createSession, destroySession, getCurrentUser } from "@/modules/auth/services/session";
import { ACTIVE_COMPANY_COOKIE } from "@/server/company-scope";

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

    if (!user?.passwordHash) return { ok: false, error: INVALID_CREDENTIALS };
    if (user.status === "DISABLED") {
      return { ok: false, error: "Llogaria juaj është çaktivizuar. Kontaktoni administratorin." };
    }

    const valid = await verifyPassword(password, user.passwordHash);
    if (!valid) return { ok: false, error: INVALID_CREDENTIALS };

    if (!user.isPlatformAdmin && user.memberships.length === 0) {
      return { ok: false, error: "Llogaria juaj nuk ka qasje në asnjë biznes aktiv." };
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date(), ...(user.status === "INVITED" ? { status: "ACTIVE" } : {}) },
    });

    await createSession(user.id);

    const jar = await cookies();
    const firstCompanyId = user.memberships[0]?.companyId;
    if (firstCompanyId) {
      jar.set(ACTIVE_COMPANY_COOKIE, firstCompanyId, {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
      });
    }

    if (user.mustChangePassword) return { ok: true, redirectTo: "/ndrysho-fjalekalimin" };
    if (user.isPlatformAdmin) return { ok: true, redirectTo: "/admin" };
    return { ok: true, redirectTo: "/paneli" };
  } catch (err) {
    console.error("[loginAction] unexpected:", err);
    return { ok: false, error: "Hyrja dështoi papritur. Provoni përsëri." };
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

    return { ok: true, redirectTo: user.isPlatformAdmin ? "/admin" : "/paneli" };
  } catch (err) {
    console.error("[changePasswordAction] unexpected:", err);
    return { ok: false, error: "Ndryshimi i fjalëkalimit dështoi papritur." };
  }
}
