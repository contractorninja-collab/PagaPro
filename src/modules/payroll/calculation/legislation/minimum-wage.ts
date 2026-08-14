/**
 * The statutory minimum monthly gross wage in Kosovo.
 *
 * One constant, because there used to be four and they disagreed: provisioning
 * wrote 350 into every new company's parameter set, the settings service fell
 * back to 425 for "current" and 500 for a scheduled July rise, and the engine
 * defaulted to 450 when a period carried no snapshot. A company that never
 * opened Konfigurimet therefore had its "below minimum wage" warnings measured
 * against a figure nobody had chosen.
 *
 * This is a *default*, not a rule: each company may set its own figure in
 * Konfigurimet, and a payroll period that has been locked keeps the snapshot it
 * was calculated against. Changing this value only affects companies that never
 * set one, and only from the next calculation.
 *
 * When the law changes, this line changes.
 */
export const KOSOVO_MINIMUM_MONTHLY_GROSS = "500";
