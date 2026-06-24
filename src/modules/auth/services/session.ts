import { createHash } from "node:crypto";
import { cache } from "react";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { generateSessionToken } from "@/modules/auth/services/password";

export const SESSION_COOKIE = "pp_session";

const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30; // 30 days

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** Creates a DB session and sets the httpOnly session cookie. Call from server actions / route handlers only. */
export async function createSession(userId: string): Promise<void> {
  const token = generateSessionToken();
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

  await prisma.session.create({
    data: { tokenHash: hashToken(token), userId, expiresAt },
  });

  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
}

export interface SessionUser {
  id: string;
  email: string;
  displayName: string | null;
  status: "INVITED" | "ACTIVE" | "DISABLED";
  isPlatformAdmin: boolean;
  mustChangePassword: boolean;
}

/** Resolves the logged-in user from the session cookie. Cached per request. */
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const session = await prisma.session.findUnique({
    where: { tokenHash: hashToken(token) },
    select: {
      expiresAt: true,
      user: {
        select: {
          id: true,
          email: true,
          displayName: true,
          status: true,
          isPlatformAdmin: true,
          mustChangePassword: true,
        },
      },
    },
  });

  if (!session) return null;
  if (session.expiresAt.getTime() <= Date.now()) return null;
  if (session.user.status !== "ACTIVE") return null;

  return session.user;
});

/** Deletes the current DB session and clears the cookie. Call from server actions / route handlers only. */
export async function destroySession(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) {
    await prisma.session.deleteMany({ where: { tokenHash: hashToken(token) } });
  }
  jar.delete(SESSION_COOKIE);
}

/** Invalidate every session of a user (deactivation, password reset by admin). */
export async function destroyAllSessionsForUser(userId: string): Promise<void> {
  await prisma.session.deleteMany({ where: { userId } });
}
