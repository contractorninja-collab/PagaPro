import type { DashboardFilters } from "../types/dashboard-types";

/** Inclusive month window in UTC (calendar month for filters.year/month). */
export function utcMonthWindow(year: number, month: number): { start: Date; end: Date } {
  const start = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
  const end = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));
  return { start, end };
}

export function startOfUtcDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0));
}

export function endOfUtcDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 23, 59, 59, 999));
}

export function parseDashboardFilters(sp: Record<string, string | string[] | undefined>): DashboardFilters {
  const now = new Date();
  const rawYear = Array.isArray(sp.year) ? sp.year[0] : sp.year;
  const rawMonth = Array.isArray(sp.month) ? sp.month[0] : sp.month;
  const rawDept = Array.isArray(sp.department) ? sp.department[0] : sp.department;

  const year = Number(rawYear);
  const month = Number(rawMonth);
  const y = Number.isFinite(year) && year >= 2000 && year <= 2100 ? year : now.getUTCFullYear();
  const m = Number.isFinite(month) && month >= 1 && month <= 12 ? month : now.getUTCMonth() + 1;
  const departmentId = rawDept?.trim() ? rawDept.trim() : null;

  return { year: y, month: m, departmentId };
}

export function daysBetweenUtc(from: Date, to: Date): number {
  const ms = startOfUtcDay(to).getTime() - startOfUtcDay(from).getTime();
  return Math.ceil(ms / (24 * 60 * 60 * 1000));
}
