import type { PitBandSnapshot } from "@/modules/payroll/calculation/types";

/**
 * Kosovo monthly progressive PIT (marginal slices), encoded as cumulative bands for
 * {@link computePrimaryProgressivePit}: slice (prevUpper, upper] taxed at `rate`.
 *
 * Matches progressive monthly logic:
 * - taxable ≤ 250 EUR: 0%
 * - 250 < taxable ≤ 450 EUR: 8% on (taxable − 250)
 * - taxable > 450 EUR: (450 − 250) × 8% + (taxable − 450) × 10%
 */
export const KOSOVO_MONTHLY_PIT_BANDS: readonly PitBandSnapshot[] = [
  { cumulativeUpperInclusive: "250", rate: "0" },
  { cumulativeUpperInclusive: "450", rate: "0.08" },
  { cumulativeUpperInclusive: "999999999999", rate: "0.10" },
] as const;

/** Default Trust contribution rates on gross (same decimal fraction employee & employer when synced from Konfigurime percent points). */
export const KOSOVO_DEFAULT_PENSION_EMPLOYEE_RATE = "0.05";
export const KOSOVO_DEFAULT_PENSION_EMPLOYER_RATE = "0.05";
