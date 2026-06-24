/**
 * Kosovo Labour Law 03/L-212 — numeric baselines for leave engines (verify against official consolidated text).
 * Articles cited in comments are operational anchors for HR traceability, not legal advice.
 */

/** Arts 20 / 31 — full-time norm referenced by payroll settings (`hoursPerWorkingDay`, `weeklyHours`). */
export const KOSOVO_FULL_TIME_WEEKLY_HOURS = 40;
export const KOSOVO_STANDARD_WORKDAY_HOURS = 8;

/** Art 32 — minimum annual paid leave operationalised as working days (4 weeks × Mon–Fri at full-time). */
export const KOSOVO_MINIMUM_ANNUAL_WORKING_DAYS = 20;

/** Art 32.3 — hazardous employment minimum annual leave (working days). */
export const KOSOVO_HAZARDOUS_MINIMUM_ANNUAL_WORKING_DAYS = 30;

/** Every N full years of service → +1 working day (company policy may tune divisor via DB). */
export const KOSOVO_TENURE_BONUS_DIVISOR_YEARS = 5;
export const KOSOVO_TENURE_BONUS_DAYS_PER_STEP = 1;

/** Art 32.4 — additional days when eligibility flags true (company policy may tune amount via DB). */
export const KOSOVO_SPECIAL_CATEGORY_EXTRA_WORKING_DAYS = 2;

/** Art 35 — months of uninterrupted service before full annual entitlement applies. */
export const KOSOVO_FIRST_YEAR_GATE_MONTHS = 6;

/** Art 36 — linear monthly accrual toward annual entitlement (20 working days / 12 months). */
export const KOSOVO_MONTHLY_ACCRUAL_WORKING_DAYS = 20 / 12;

/** Art 37.6 — carry-over usage deadline (following calendar year). */
export const KOSOVO_CARRY_OVER_EXPIRY_MONTH = 6; // June (1–12)
export const KOSOVO_CARRY_OVER_EXPIRY_DAY = 30;

/** Art 37.6 — at least one segment must reach this many uninterrupted working days when splitting annual leave. */
export const KOSOVO_SPLIT_LEAVE_MIN_SEGMENT_WORKING_DAYS = 10;

/** Art 39 — statutory paid calendar-day norms (converted to working-day checks separately in validators). */
export const KOSOVO_PAID_EVENT_WORKING_DAY_NORMS = {
  MARTESE: 5,
  VDEKJE_FAMILJARE: 5,
  LINDJE_FEMIJE: 3,
  DHURIM_GJAKU: 1,
} as const;

/** Art 50 — paternity paid slice (working days norm for validation hints). */
export const KOSOVO_PATERNITY_PAID_WORKING_DAYS = 2;

/** Art 23 — overtime weekly ceiling (hours); surfaced for cross-module warnings, not leave-day math. */
export const KOSOVO_OVERTIME_WEEKLY_MAX_HOURS = 8;
