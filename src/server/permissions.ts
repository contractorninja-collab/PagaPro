import type { CompanyMembershipRole } from "@prisma/client";

/**
 * What each company role is allowed to change.
 *
 * The five roles have existed in the schema since the beginning and
 * `getCompanyContext()` has always returned one, but nothing read it: every
 * member of a company could run payroll, terminate staff and read every salary.
 * This module is the single place that answers "may they?", so the answer
 * cannot drift between the server action, the API route and the button.
 *
 * Reading is deliberately NOT gated, with TWO exceptions. A member of a company
 * may see everything in it, salaries included — the roles separate who can
 * *change* things.
 *
 *   1. `documents.sensitive`: medical and disciplinary files in an employee's
 *      dossier are special-category personal data under the Kosovo LMDhP
 *      (06/L-082), so seeing them requires the capability — enforced in the
 *      list service, the download route and the UI.
 *   2. `payroll.prepare` also guards two *reads*: the payment list at
 *      `api/payroll/[id]/export-bank-list` and the payslip PDFs at
 *      `api/payroll-documents/[id]`. Both hand over decrypted bank account
 *      numbers in bulk — a payment rail, not a salary figure — which is why
 *      `field-crypto` exists at all. Do not "fix" these back to plain company
 *      membership; the gate is the point.
 */

export type Capability =
  /** Create, edit, terminate, rehire and import staff; job titles and departments. */
  | "employees.write"
  /** Request, approve, revoke leave; balance adjustments. */
  | "leave.write"
  /** Generate, regenerate and archive documents, contracts, annexes, warnings; upload employee files. */
  | "documents.write"
  /** See and download MJEKESORE/DISIPLINORE employee documents — the one read gate. */
  | "documents.sensitive"
  /** Kiosk pairing, punch corrections, attendance resolution. */
  | "timeclock.write"
  /** Draft, recalculate, correct and export a payroll period. */
  | "payroll.prepare"
  /** Review, approve, lock, archive — the irreversible steps that freeze amounts. */
  | "payroll.signoff"
  /** Konfigurimet: company profile, payroll parameters, holidays, representatives, leave policy. */
  | "company.settings";

/**
 * Agreed with the product owner:
 *
 *   - READ_ONLY writes nothing at all, but reads everything.
 *   - HR_MANAGER runs the company day to day, but does not sign payroll off and
 *     does not change company settings.
 *   - ACCOUNTANT owns payroll end to end, including sign-off, and edits staff
 *     (they set salaries), but does not change company settings.
 *   - OWNER and ADMIN may do everything.
 */
const ROLE_CAPABILITIES: Record<CompanyMembershipRole, ReadonlySet<Capability>> = {
  OWNER: new Set<Capability>([
    "employees.write",
    "leave.write",
    "documents.write",
    "documents.sensitive",
    "timeclock.write",
    "payroll.prepare",
    "payroll.signoff",
    "company.settings",
  ]),
  ADMIN: new Set<Capability>([
    "employees.write",
    "leave.write",
    "documents.write",
    "documents.sensitive",
    "timeclock.write",
    "payroll.prepare",
    "payroll.signoff",
    "company.settings",
  ]),
  HR_MANAGER: new Set<Capability>([
    "employees.write",
    "leave.write",
    "documents.write",
    "documents.sensitive",
    "timeclock.write",
    "payroll.prepare",
  ]),
  ACCOUNTANT: new Set<Capability>([
    "employees.write",
    "leave.write",
    "documents.write",
    "timeclock.write",
    "payroll.prepare",
    "payroll.signoff",
  ]),
  READ_ONLY: new Set<Capability>(),
};

export interface PermissionSubject {
  role: CompanyMembershipRole | null;
  isPlatformAdmin: boolean;
}

/**
 * Platform admins bypass the matrix — they enter tenants for support and may
 * hold no membership at all, which is why `role` is nullable. A null role on a
 * non-platform-admin is not a member and can do nothing.
 */
export function can(subject: PermissionSubject, capability: Capability): boolean {
  if (subject.isPlatformAdmin) return true;
  if (subject.role == null) return false;
  return ROLE_CAPABILITIES[subject.role].has(capability);
}

/** Every capability a subject holds — for handing the UI what to render. */
export function capabilitiesOf(subject: PermissionSubject): Capability[] {
  return ALL_CAPABILITIES.filter((c) => can(subject, c));
}

export const ALL_CAPABILITIES: readonly Capability[] = [
  "employees.write",
  "leave.write",
  "documents.write",
  "documents.sensitive",
  "timeclock.write",
  "payroll.prepare",
  "payroll.signoff",
  "company.settings",
];

/**
 * One message, in Albanian, for every refusal. Deliberately says what is
 * missing rather than "forbidden": the client is a colleague who picked the
 * wrong menu, not an attacker, and they need to know who to ask.
 */
const CAPABILITY_DENIAL_SQ: Record<Capability, string> = {
  "employees.write": "Nuk keni leje të ndryshoni të dhënat e punonjësve.",
  "leave.write": "Nuk keni leje të ndryshoni pushimet.",
  "documents.write": "Nuk keni leje të gjeneroni ose ndryshoni dokumente.",
  "documents.sensitive": "Nuk keni leje të shihni dokumentet mjekësore ose disiplinore.",
  "timeclock.write": "Nuk keni leje të ndryshoni prezencën.",
  "payroll.prepare": "Nuk keni leje të përgatitni pagat.",
  "payroll.signoff": "Nuk keni leje të miratoni ose mbyllni pagat.",
  "company.settings": "Nuk keni leje të ndryshoni konfigurimet e kompanisë.",
};

export function capabilityDeniedMessage(capability: Capability): string {
  return CAPABILITY_DENIAL_SQ[capability];
}
