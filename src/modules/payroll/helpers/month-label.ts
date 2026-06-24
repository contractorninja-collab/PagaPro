const MONTHS_SQ = [
  "Janar",
  "Shkurt",
  "Mars",
  "Prill",
  "Maj",
  "Qershor",
  "Korrik",
  "Gusht",
  "Shtator",
  "Tetor",
  "Nëntor",
  "Dhjetor",
];

/** `month` 1–12 */
export function payrollMonthNameSq(month: number): string {
  return MONTHS_SQ[month - 1] ?? String(month);
}

export function payrollMonthLabel(year: number, month: number): string {
  const m = payrollMonthNameSq(month);
  return `${m} ${year}`;
}
