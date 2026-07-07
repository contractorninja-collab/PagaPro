import { payrollMonthNameSq } from "@/modules/payroll/helpers/month-label";

/** Safe filename segment (ASCII, no path chars). */
export function sanitizeFilenamePart(raw: string): string {
  return raw
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 48);
}

/** e.g. Ajeti_Arines_Qershor_2026.pdf */
export function buildPayslipFilename(params: {
  firstName: string;
  lastName: string;
  year: number;
  month: number;
}): string {
  const monthName = payrollMonthNameSq(params.month);
  const parts = [
    sanitizeFilenamePart(params.lastName),
    sanitizeFilenamePart(params.firstName),
    sanitizeFilenamePart(monthName),
    String(params.year),
  ].filter(Boolean);
  return `${parts.join("_")}.pdf`;
}

/** Combined print bundle for all employee payslips in a period. */
export function buildPayslipBundleFilename(year: number, month: number, prefix?: string): string {
  const monthName = payrollMonthNameSq(month);
  const p = prefix ? `${sanitizeFilenamePart(prefix)}_` : "";
  return `${p}Fletepagesat_${sanitizeFilenamePart(monthName)}_${year}.pdf`;
}
