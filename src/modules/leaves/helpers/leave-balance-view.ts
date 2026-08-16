import type { PushimetBalanceRowDto } from "@/modules/leaves/types/pushimet";

/**
 * Presentation helpers for a leave balance row.
 *
 * These live outside the component for one reason: the stat line used to be
 * built by string concatenation inside JSX, which made "no row ever prints
 * `Përdorur 0 · Pritje 0` again" a claim nobody could assert on. Here it is a
 * pure function with a test.
 */

/** Prisma Decimals arrive as strings; anything unparseable is zero, never NaN. */
export function toNum(value: string | null | undefined): number {
  const v = Number(value);
  return Number.isFinite(v) ? v : 0;
}

/** Two decimals at most, trailing zeros dropped: 12.50 -> "12.5", 12.00 -> "12". */
export function fmtDays(value: string | number | null | undefined): string {
  const v = typeof value === "number" ? value : toNum(value);
  return String(Math.round((v + Number.EPSILON) * 100) / 100);
}

/**
 * Whole days from `todayIso` until `iso`, negative once past.
 *
 * `todayIso` is a parameter and not `Date.now()` on purpose. The old version
 * read the clock during render of a component that is server-rendered first,
 * so a page crossing a UTC midnight hydrated with two different answers — and
 * nothing about carry-over expiry could be unit-tested.
 */
export function daysUntilIso(iso: string | null | undefined, todayIso: string): number | null {
  if (!iso) return null;
  const then = Date.parse(iso);
  const now = Date.parse(todayIso);
  if (!Number.isFinite(then) || !Number.isFinite(now)) return null;
  return Math.ceil((then - now) / 86_400_000);
}

/** "Kuota 22 (20 +2 vjetërsi)" when tenure or hazard days apply, else "Kuota 20". */
export function entitlementLabel(row: PushimetBalanceRowDto): string {
  const quota = fmtDays(row.yearlyQuota);
  const bd = row.entitlementBreakdown;
  if (!bd || (bd.tenure <= 0 && bd.special <= 0)) return `Kuota ${quota}`;
  const parts = [String(bd.base)];
  if (bd.tenure > 0) parts.push(`+${bd.tenure} vjetërsi`);
  if (bd.special > 0) parts.push(`+${bd.special} kategori`);
  return `Kuota ${quota} (${parts.join(" ")})`;
}

/**
 * The one-line summary under an employee's name, with every zero removed.
 *
 * The old line printed all five figures unconditionally, so thirteen of
 * eighteen employees carried the identical string `Kuota 20 · Akumuluar 12.27 ·
 * Përdorur 0 · Pritje 0 · Fund viti 20`. Only the quota is always meaningful;
 * everything else earns its place by being non-zero, and the projection earns
 * its place by differing from the figure already shown beside the name.
 */
export function balanceStatSegments(row: PushimetBalanceRowDto): string[] {
  const segments = [entitlementLabel(row)];

  const carry = toNum(row.carryOverDays);
  if (carry > 0) segments.push(`Bartur ${fmtDays(carry)}`);

  const used = toNum(row.usedDays);
  if (used > 0) segments.push(`Përdorur ${fmtDays(used)}`);

  const pending = toNum(row.pendingDays);
  if (pending > 0) segments.push(`Pritje ${fmtDays(pending)}`);

  // The projection earns its place only by being news. It is not news when it
  // equals the quota — that is simply "nothing has happened yet", which is the
  // state of most of the company for most of the year. Nor when it equals the
  // remaining figure already printed beside the name, which is the same number
  // twice. What is left is the case worth reading: days have been spent or
  // booked away, or carry-over has lifted the year above the quota.
  if (row.projectedYearEndDays != null) {
    const projected = toNum(row.projectedYearEndDays);
    const isDefaultOutcome = Math.abs(projected - toNum(row.yearlyQuota)) <= 0.005;
    const repeatsRemaining = Math.abs(projected - toNum(row.remainingDays)) <= 0.005;
    if (!isDefaultOutcome && !repeatsRemaining) {
      segments.push(`Fund viti ${fmtDays(projected)}`);
    }
  }

  return segments;
}
