/**
 * Art 37.6 — one annual-leave segment must reach minimum uninterrupted working days when splitting.
 * Returns compliant if any single approved segment meets the threshold.
 */
export function annualSplitLeaveCompliant(segmentsWorkingDays: number[], minSegmentWorkingDays: number): boolean {
  if (segmentsWorkingDays.length === 0) return true;
  return segmentsWorkingDays.some((d) => d >= minSegmentWorkingDays);
}
