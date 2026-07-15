import { D, type MoneyDecimal } from "@/modules/payroll/calculation/money/decimal";

/**
 * Kolona e kombinuar "Pushim Orë" në spreadsheet: shfaq totalin (vjetor/paguar +
 * mjekësor + pa pagesë). Redaktimi ndryshon vetëm pjesën e PAGUAR — orët mjekësore
 * dhe pa pagesë derivohen nga pushimet e miratuara dhe mbeten fikse.
 */

const fmt = (v: MoneyDecimal): string => v.toDecimalPlaces(2).toString();

/** Parse i sigurt: string bosh → 0; hyrje e pavlefshme → null (Decimal hedh në input jo-numerik). */
function safeD(raw: string): MoneyDecimal | null {
  const s = String(raw ?? "").trim().replace(",", ".");
  if (s === "") return D(0);
  try {
    const v = D(s);
    return v.isFinite() ? v : null;
  } catch {
    return null;
  }
}

/** Totali i shfaqur i orëve të pushimit (paguar + mjekësor + pa pagesë), 2dp. */
export function combinedLeaveHoursTotal(paid: string, sick: string, unpaid: string): string {
  const t = (safeD(paid) ?? D(0)).plus(safeD(sick) ?? D(0)).plus(safeD(unpaid) ?? D(0));
  return fmt(t);
}

/**
 * Nga totali i futur nga përdoruesi → orët e reja të PAGUARA (total − mjekësor − pa pagesë).
 * Totali s'mund të bjerë nën orët mjekësore + pa pagesë (ato vijnë nga pushimet e miratuara).
 */
export function paidLeaveFromCombinedTotal(
  totalInput: string,
  sick: string,
  unpaid: string,
): { ok: true; paid: string } | { ok: false; minimum: string } {
  const fixed = (safeD(sick) ?? D(0)).plus(safeD(unpaid) ?? D(0));
  const total = safeD(totalInput);
  if (total == null || total.isNegative()) {
    return { ok: false, minimum: fmt(fixed) };
  }
  const paid = total.minus(fixed);
  if (paid.isNegative()) {
    return { ok: false, minimum: fmt(fixed) };
  }
  return { ok: true, paid: fmt(paid) };
}
