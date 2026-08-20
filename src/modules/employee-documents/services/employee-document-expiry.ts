/**
 * Expiry classification for employee documents — the single source for the
 * profile badge and both dashboard services, so the bell count and the alert
 * panel can never disagree on what "expiring" means.
 *
 * Pure: callers pass `now`; nothing here reads the clock.
 */

export const EMPLOYEE_DOCUMENT_EXPIRY_HORIZON_DAYS = 60;

export type ExpiryStatus = "expired" | "expiring" | "ok";

export function classifyExpiry(expiresAt: Date | string | null | undefined, now: Date): ExpiryStatus {
  if (expiresAt == null) return "ok";
  const at = typeof expiresAt === "string" ? new Date(expiresAt) : expiresAt;
  if (Number.isNaN(at.getTime())) return "ok";
  if (at.getTime() < now.getTime()) return "expired";
  const horizon = now.getTime() + EMPLOYEE_DOCUMENT_EXPIRY_HORIZON_DAYS * 24 * 60 * 60 * 1000;
  return at.getTime() <= horizon ? "expiring" : "ok";
}
