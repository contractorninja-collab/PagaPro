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
  { sourceCode: "XK_CONSTITUTION_DAY", month: 4, day: 9, defaultNameSq: "Dita e Kushtetutës" },
  { sourceCode: "XK_LABOUR_DAY", month: 5, day: 1, defaultNameSq: "Dita Ndërkombëtare e Punës" },
  { sourceCode: "XK_EUROPE_DAY", month: 5, day: 9, defaultNameSq: "Dita e Evropës" },
  { sourceCode: "XK_CATHOLIC_CHRISTMAS", month: 12, day: 25, defaultNameSq: "Krishtlindjet katolike" },
] as const;

export interface KosovoOfficialMovableHolidayDefinition {
  sourceCode: string;
  defaultNameSq: string;
  /**
   * Known observed dates per calendar year. Movable feasts (Bajramet, Pashkët)
   * shift every year — HR refreshes the date from the Festat panel for years
   * not listed here; the import pre-fills the years we know.
   */
  datesByYear: Readonly<Record<number, { month: number; day: number }>>;
}

/**
 * Official movable holidays (Ligji Nr. 03/L-064). 2026 dates confirmed by the client.
 *
 * Named plainly — "Fitër Bajrami" and "Kurban Bajrami" — rather than "i Madh" /
 * "i Vogël". The two labels had been attached to the wrong feast (20 March, the
 * end of Ramadan, was carrying "i Madh"), and since the plain names are the
 * unambiguous ones there is nothing left to get backwards.
 *
 * The `sourceCode` values keep their original spelling on purpose: they are the
 * identity a holiday row is matched by, so renaming one would orphan every date
 * HR has already corrected. Read them as opaque keys, not as descriptions —
 * XK_BAJRAM_I_MADH is the Ramadan feast and XK_BAJRAM_I_VOGEL the sacrifice one.
 *
 * Dates are deliberately known for 2026 only. HR sets them each year from the
 * Festat panel, because Kosovo's Bajram dates are announced by the Islamic
 * Community and an astronomical estimate can be a day out.
 */
export const KOSOVO_OFFICIAL_MOVABLE_HOLIDAY_DEFINITIONS: readonly KosovoOfficialMovableHolidayDefinition[] = [
  {
    sourceCode: "XK_BAJRAM_I_MADH",
    defaultNameSq: "Fitër Bajrami",
    datesByYear: { 2026: { month: 3, day: 20 } },
  },
  {
    sourceCode: "XK_CATHOLIC_EASTER",
    defaultNameSq: "Pashkët Katolike",
    datesByYear: { 2026: { month: 4, day: 5 } },
  },
  {
    sourceCode: "XK_ORTHODOX_EASTER",
    defaultNameSq: "Pashkët Ortodokse",
    datesByYear: { 2026: { month: 4, day: 12 } },
  },
  {
    sourceCode: "XK_BAJRAM_I_VOGEL",
    defaultNameSq: "Kurban Bajrami",
    datesByYear: { 2026: { month: 5, day: 27 } },
  },
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
