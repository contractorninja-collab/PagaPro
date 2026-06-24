/**
 * Kosovo-oriented public holiday definitions.
 * Expected-hours baselines read configured holidays from the database (`CompanyHoliday`);
 * this module supplies canonical codes + default Albanian labels for HR import flows.
 */

/** Observed on civil calendar month-day (UTC date walk aligns with payroll month iteration). */
export const KOSOVO_BASE_PUBLIC_HOLIDAYS_MM_DD = [
  "01-01",
  "01-07",
  "02-17",
  "05-01",
  "12-25",
] as const;

export interface KosovoOfficialFixedHolidayDefinition {
  sourceCode: string;
  month: number;
  day: number;
  defaultNameSq: string;
}

/**
 * Official Kosovo holidays that recur on the same civil date each year (non-exhaustive — movable dates are HR-managed).
 * Keep `prisma/seed.cjs` Kosovo rows in sync when changing codes/dates/names (dev bootstrap).
 */
export const KOSOVO_OFFICIAL_FIXED_HOLIDAY_DEFINITIONS: readonly KosovoOfficialFixedHolidayDefinition[] = [
  { sourceCode: "XK_NEW_YEAR", month: 1, day: 1, defaultNameSq: "Viti i Ri" },
  { sourceCode: "XK_ORTHODOX_CHRISTMAS", month: 1, day: 7, defaultNameSq: "Krishtlindjet ortodokse" },
  { sourceCode: "XK_INDEPENDENCE_DAY", month: 2, day: 17, defaultNameSq: "Dita e Pavarësisë" },
  { sourceCode: "XK_LABOUR_DAY", month: 5, day: 1, defaultNameSq: "Dita Ndërkombëtare e Punës" },
  { sourceCode: "XK_CATHOLIC_CHRISTMAS", month: 12, day: 25, defaultNameSq: "Krishtlindjet katolike" },
] as const;

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

export function isoDateUtc(year: number, month: number, day: number): string {
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

export function monthDayLabel(month: number, day: number): string {
  return `${pad2(month)}-${pad2(day)}`;
}

export function isFixedKosovoPublicHoliday(month: number, day: number): boolean {
  return (KOSOVO_BASE_PUBLIC_HOLIDAYS_MM_DD as readonly string[]).includes(monthDayLabel(month, day));
}
