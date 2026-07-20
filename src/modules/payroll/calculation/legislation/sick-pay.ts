import { D } from "../money/decimal";

/**
 * Neni 60, Ligji i Punës Nr. 03/L-212: pushimi mjekësor i paguar kompensohet me
 * 100% të pagës. Përqindja në PayrollSettings ekziston si multiplikator teknik,
 * por ligjërisht është DYSHEME — çdo vlerë nën 1 (100%) është jokonform dhe
 * ngrihet në minimumin statutor. Vlerat mbi 1 lejohen (punëdhënës më bujar).
 */
export const KOSOVO_SICK_PAY_STATUTORY_MINIMUM = "1";

export function statutorySickLeavePayPercent(raw: string | null | undefined): string {
  const s = String(raw ?? "").trim();
  if (s === "") return KOSOVO_SICK_PAY_STATUTORY_MINIMUM;
  try {
    const v = D(s);
    if (!v.isFinite() || v.lt(1)) return KOSOVO_SICK_PAY_STATUTORY_MINIMUM;
    return s;
  } catch {
    return KOSOVO_SICK_PAY_STATUTORY_MINIMUM;
  }
}
