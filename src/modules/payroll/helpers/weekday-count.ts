/** Count Mon–Fri days inclusive between UTC calendar dates (ignores holidays). */
export function countWeekdaysInclusiveUtc(start: Date, end: Date): number {
  const s = Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate());
  const e = Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate());
  if (s > e) return 0;
  let n = 0;
  for (let t = s; t <= e; t += 86400000) {
    const dow = new Date(t).getUTCDay();
    if (dow !== 0 && dow !== 6) n++;
  }
  return n;
}
