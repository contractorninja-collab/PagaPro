import type { LeaveRequestStatus, LeaveType } from "@prisma/client";
import type { LeaveListFilters } from "@/modules/leaves/services/leave-query-service";

/**
 * One reader for the Pushimet query string, shared by the page and the CSV
 * export route.
 *
 * The export exists to hand someone the list they are looking at. If it parsed
 * the same parameters separately, the two would drift the moment either side
 * gained a filter — and a CSV that quietly disagrees with the screen is worse
 * than no CSV, because nothing about the file says it disagrees.
 */

export type LeaveSearchParams = Record<string, string | string[] | undefined>;

const LEAVE_TYPES = new Set<LeaveType>([
  "PUSHIM_VJETOR",
  "PUSHIM_MJEKESOR",
  "PUSHIM_PERSONAL",
  "PUSHIM_PA_PAGESE",
  "PUSHIM_LEHONIE",
  "TJETER",
]);

const STATUSES = new Set<LeaveRequestStatus>([
  "DRAFT",
  "PENDING",
  "APPROVED",
  "REJECTED",
  "CANCELLED",
]);

export interface ParsedLeaveListParams {
  filters: LeaveListFilters;
  /** Raw values, echoed back into the filter form so the controls stay selected. */
  employeeId: string;
  departmentId: string;
  type: string;
  status: string;
  /** Resolved year/month the calendar draws — always a real month. */
  year: number;
  month: number;
  /** `month=0` — the list spans the whole year while the calendar keeps one month. */
  allMonths: boolean;
  page: number;
}

function first(sp: LeaveSearchParams, key: string): string {
  const v = sp[key];
  if (Array.isArray(v)) return v[0] ?? "";
  return v ?? "";
}

export function parseLeaveListParams(
  sp: LeaveSearchParams,
  now: Date = new Date(),
): ParsedLeaveListParams {
  const defaultYear = now.getUTCFullYear();
  const defaultMonth = now.getUTCMonth() + 1;

  const employeeId = first(sp, "employeeId");
  const departmentId = first(sp, "departmentId");
  const typeRaw = first(sp, "type");
  const statusRaw = first(sp, "status");
  const monthRaw = first(sp, "month");

  const filterYear = Number(first(sp, "year"));
  const filterMonth = Number(monthRaw);

  /**
   * `Number("")` is 0 and 0 is finite, so an absent `year` used to resolve to
   * year 0 — the bare `/pushimet` filtered to nothing and drew a 1900 calendar.
   */
  const year =
    Number.isInteger(filterYear) && filterYear >= 1970 && filterYear <= 2100
      ? filterYear
      : defaultYear;

  /**
   * `month=0` means "the whole year" for the *list*. The calendar always draws
   * one month, so it keeps its own value — otherwise a stat tile could only
   * ever show the requests that happen to fall in the month on screen.
   */
  const allMonths = monthRaw === "0";
  const month =
    !allMonths && Number.isFinite(filterMonth) && filterMonth >= 1 && filterMonth <= 12
      ? filterMonth
      : defaultMonth;

  const type = LEAVE_TYPES.has(typeRaw as LeaveType) ? typeRaw : "";
  const status = STATUSES.has(statusRaw as LeaveRequestStatus) ? statusRaw : "";

  const pageRaw = Number(first(sp, "page"));
  const page = Number.isFinite(pageRaw) && pageRaw > 0 ? Math.floor(pageRaw) : 1;

  return {
    filters: {
      employeeId: employeeId || undefined,
      departmentId: departmentId || undefined,
      type: (type || undefined) as LeaveType | undefined,
      status: (status || undefined) as LeaveRequestStatus | undefined,
      year,
      month: allMonths ? undefined : month,
    },
    employeeId,
    departmentId,
    type,
    status,
    year,
    month,
    allMonths,
    page,
  };
}
