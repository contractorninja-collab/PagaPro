/** Fixed-width stand-in, so a column does not resize when masking is toggled. */
export const AMOUNT_MASK = "••••••";

/**
 * What to print in place of a money figure. Pure so the rule can be asserted
 * without a DOM: every salary surface calls this, and any of them forgetting to
 * is the failure mode worth guarding against.
 */
export function maskAmount(formatted: string, hidden: boolean): string {
  return hidden ? AMOUNT_MASK : formatted;
}
