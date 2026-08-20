import { fmtDays, toNum } from "@/modules/leaves/helpers/leave-balance-view";

/**
 * View model for the employee profile's Pushimet tab.
 *
 * Kept as a pure module so the zero-suppression rule is testable: a balance
 * line never prints "Përdorur 0 · Pritje 0" — the same rule the Pushimet
 * balance panel enforces, restated here for the profile's compact line.
 */
export interface EmployeeLeaveBalanceSummary {
  leaveType: string;
  /** Decimal columns serialized with .toFixed(2) on the server. */
  quota: string;
  used: string;
  pending: string;
  remaining: string;
  carryIn: string;
  carryExpiresAtIso: string | null;
}

export interface EmployeeLeaveRequestSummary {
  id: string;
  type: string;
  subtype: string;
  status: string;
  startIso: string;
  endIso: string;
  /** workingDays if computed, else totalDays, else null. */
  days: string | null;
}

export interface EmployeeLeaveBundle {
  year: number;
  balances: EmployeeLeaveBalanceSummary[];
  requests: EmployeeLeaveRequestSummary[];
}

/** "Kuota 20 · Përdorur 3 · Mbetur 9,27" — zeros suppressed, remaining always shown. */
export function balanceLineSegments(b: EmployeeLeaveBalanceSummary): string[] {
  const out: string[] = [`Kuota ${fmtDays(b.quota)}`];
  if (toNum(b.used) > 0) out.push(`Përdorur ${fmtDays(b.used)}`);
  if (toNum(b.pending) > 0) out.push(`Pritje ${fmtDays(b.pending)}`);
  if (toNum(b.carryIn) > 0) out.push(`Bartur ${fmtDays(b.carryIn)}`);
  out.push(`Mbetur ${fmtDays(b.remaining)}`);
  return out;
}

/** Annual leave first — it is the balance people come to check. */
export function sortBalancesForDisplay(
  rows: EmployeeLeaveBalanceSummary[],
): EmployeeLeaveBalanceSummary[] {
  const rank = (t: string) => (t === "PUSHIM_VJETOR" ? 0 : t === "PUSHIM_PERSONAL" ? 1 : 2);
  return [...rows].sort((a, b) => rank(a.leaveType) - rank(b.leaveType) || a.leaveType.localeCompare(b.leaveType));
}
