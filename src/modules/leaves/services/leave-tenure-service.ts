/** Uninterrupted calendar months from anchor (inclusive) to asOf (inclusive), UTC civil dates. */
export function uninterruptedCalendarMonthsUtc(anchor: Date, asOfUtc: Date): number {
  if (asOfUtc.getTime() < anchor.getTime()) return 0;
  let months =
    (asOfUtc.getUTCFullYear() - anchor.getUTCFullYear()) * 12 +
    (asOfUtc.getUTCMonth() - anchor.getUTCMonth());
  if (asOfUtc.getUTCDate() < anchor.getUTCDate()) months--;
  return Math.max(0, months);
}
