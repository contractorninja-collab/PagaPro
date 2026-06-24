import type { LeaveSubtype, LeaveType } from "@prisma/client";

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