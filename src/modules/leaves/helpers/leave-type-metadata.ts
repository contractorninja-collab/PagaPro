import type { LeaveSubtype, LeaveType } from "@prisma/client";
import { KOSOVO_REGULAR_MEDICAL_LEAVE_WORKING_DAYS } from "@/modules/leaves/constants/kosovo-law";

/** Albanian operational labels + payroll defaults (centralized; UI imports from here). */
export const LEAVE_TYPE_LABELS_SQ: Record<LeaveType, string> = {
  PUSHIM_VJETOR: "Pushim vjetor",
  PUSHIM_MJEKESOR: "Pushim mjekësor",
  PUSHIM_PERSONAL: "Pushim personal",
  PUSHIM_PA_PAGESE: "Pushim pa pagesë",
  PUSHIM_LEHONIE: "Pushim lehonie / prindëror",
  TJETER: "Tjetër",
};

export const LEAVE_SUBTYPE_LABELS_SQ: Record<LeaveSubtype, string> = {
  NONE: "—",
  LENDIM_PUNE_OSE_SEMUNDJE_PROFESIONALE: "Lëndim në punë / sëmundje profesionale",
  MARTESE: "Martesë (Art 39)",
  VDEKJE_FAMILJARE: "Vdekje familjare (Art 39)",
  LINDJE_FEMIJE: "Lindje fëmije (Art 39)",
  DHURIM_GJAKU: "Dhurim gjaku (Art 39)",
  ATERSI_PAGUAR_2_DITE: "Atersi — 2 ditë të paguara (Art 50)",
  ATERSI_PA_PAGESE_JAVE_2: "Atersi — 2 javë pa pagesë (Art 50)",
  LEHONI_FAZA_PUNEDHENESI_70: "Lehonie — faza punëdhënësi 70% (Art 49)",
  LEHONI_FAZA_QEVERIA_50: "Lehonie — faza Qeveria 50% (Art 49)",
  LEHONI_FAZA_FUNDIT_PA_PAGESE: "Lehonie — faza fundit pa pagesë (Art 49)",
};

export const OCCUPATIONAL_MEDICAL_LEAVE_SUBTYPE: LeaveSubtype = "LENDIM_PUNE_OSE_SEMUNDJE_PROFESIONALE";

export const LEAVE_TYPE_HELP_SQ: Partial<Record<LeaveType, string>> = {
  PUSHIM_MJEKESOR: `Pushim mjekësor i rregullt: deri në ${KOSOVO_REGULAR_MEDICAL_LEAVE_WORKING_DAYS} ditë pune në vit kalendarik. Lëndimi në punë ose sëmundja profesionale regjistrohet si nën-lloj i veçantë dhe nuk konsumon këtë kuotë.`,
};

export function isOccupationalMedicalLeave(subtype: LeaveSubtype | null | undefined): boolean {
  return (subtype ?? "NONE") === OCCUPATIONAL_MEDICAL_LEAVE_SUBTYPE;
}

/** Subtypes offered when creating a medical leave request. */
export function medicalLeaveSubtypesForForm(): LeaveSubtype[] {
  return ["NONE", OCCUPATIONAL_MEDICAL_LEAVE_SUBTYPE];
}

export function medicalLeaveSubtypeLabel(subtype: LeaveSubtype): string {
  if (subtype === "NONE") return "Pushim mjekësor i rregullt";
  return LEAVE_SUBTYPE_LABELS_SQ[subtype];
}

export function subtypesForLeaveType(type: LeaveType): LeaveSubtype[] {
  if (type === "PUSHIM_MJEKESOR") return medicalLeaveSubtypesForForm();
  return (Object.keys(LEAVE_SUBTYPE_LABELS_SQ) as LeaveSubtype[]).filter(
    (k) => k !== OCCUPATIONAL_MEDICAL_LEAVE_SUBTYPE,
  );
}

/** Default flags when creating a request — HR may override before submit. Subtypes refine payroll classification. */
export function defaultPaidAndPayrollFlags(
  type: LeaveType,
  subtype: LeaveSubtype | null | undefined = "NONE",
): { isPaid: boolean; affectsPayroll: boolean } {
  const st = subtype ?? "NONE";

  if (st === "ATERSI_PA_PAGESE_JAVE_2" || st === "LEHONI_FAZA_FUNDIT_PA_PAGESE") {
    return { isPaid: false, affectsPayroll: true };
  }

  switch (type) {
    case "PUSHIM_PA_PAGESE":
      return { isPaid: false, affectsPayroll: true };
    case "PUSHIM_VJETOR":
    case "PUSHIM_MJEKESOR":
    case "PUSHIM_PERSONAL":
    case "PUSHIM_LEHONIE":
      return { isPaid: true, affectsPayroll: true };
    default:
      return { isPaid: true, affectsPayroll: true };
  }
}

export function leaveTypesWithBalance(): LeaveType[] {
  return ["PUSHIM_VJETOR", "PUSHIM_PERSONAL", "PUSHIM_MJEKESOR"];
}

/**
 * Albanian names for the timeline's event types.
 *
 * The detail page printed the raw enum — "LEAVE_PAYROLL_SYNC_SKIPPED" — under
 * every entry. Anything unmapped falls back to a readable form of the enum
 * rather than disappearing, so a newly added event type degrades instead of
 * showing a blank line.
 */
const LEAVE_EVENT_LABELS_SQ: Record<string, string> = {
  LEAVE_REQUESTED: "Kërkesë e re",
  LEAVE_SUBMITTED: "Dërguar për miratim",
  LEAVE_APPROVED: "Miratuar",
  LEAVE_REJECTED: "Refuzuar",
  LEAVE_CANCELLED: "Anuluar",
  LEAVE_REVOKED: "Revokuar",
  LEAVE_DOCUMENT_GENERATED: "Dokument i gjeneruar",
  LEAVE_PAYROLL_SYNC_SKIPPED: "Nuk arriti te payroll-i",
  LEAVE_PAYROLL_SYNCED: "Sinkronizuar me payroll-in",
  LEAVE_BALANCE_OVERRIDE: "Tejkalim bilanci i aprovuar",
  LEAVE_INTERRUPTED_BY_SICK: "Ndërprerë nga pushimi mjekësor",
};

export function leaveEventLabelSq(eventType: string): string {
  return (
    LEAVE_EVENT_LABELS_SQ[eventType] ??
    eventType.replace(/^LEAVE_/, "").replace(/_/g, " ").toLowerCase()
  );
}
