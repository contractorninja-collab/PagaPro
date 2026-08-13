import { prisma } from "@/lib/prisma";

/**
 * Credential-stuffing brake. DB-backed because the app runs serverless — an
 * in-memory counter resets with every cold start, which an attacker gets for
 * free by simply waiting.
 *
 * The window counts per email address: it is the credential being attacked
 * that needs protecting, wherever the attempts come from. The IP is recorded
 * for the audit trail, not used as the key — NAT would let one office lock
 * itself out, and rotating IPs are the cheapest thing an attacker has.
 */

const WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILURES = 5;

/** Generic on purpose — a precise lockout message confirms the address exists. */
export const THROTTLED_MESSAGE =
  "Shumë përpjekje të dështuara. Provoni përsëri pas disa minutash.";

export async function isLoginThrottled(email: string): Promise<boolean> {
  const failures = await prisma.loginAttempt.count({
    where: {
      email: email.toLowerCase(),
      success: false,
      createdAt: { gte: new Date(Date.now() - WINDOW_MS) },
    },
  });
  return failures >= MAX_FAILURES;
}

export async function recordLoginAttempt(params: {
  email: string;
  ip: string | null;
  success: boolean;
}): Promise<void> {
  try {
    await prisma.loginAttempt.create({
      data: {
        email: params.email.toLowerCase(),
        ip: params.ip,
        success: params.success,
      },
    });
    if (params.success) {
      // A correct password ends the episode: clear the window so the real
      // owner is not locked out by an attack that just ended, and prune old
      // rows — attempts are throttle state, not a permanent surveillance log.
      await prisma.loginAttempt.deleteMany({
        where: {
          OR: [
            { email: params.email.toLowerCase(), success: false },
            { createdAt: { lt: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
          ],
        },
      });
    }
  } catch (err) {
    // Recording must never turn a working login into an outage.
    console.error("[pagapro] login attempt record failed", err);
  }
}
