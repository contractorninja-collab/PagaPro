export type PayrollAnchorMode = "PERIOD_END" | "PERIOD_START";

/** `month` is 1–12. Returns UTC midnight anchor used for legislation / minimum wage dating. */
export function payrollAnchorDateUtc(year: number, month: number, mode: PayrollAnchorMode): Date {
  if (mode === "PERIOD_START") {
    return new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
  }
  return new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));
}

export function calendarDaysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}
