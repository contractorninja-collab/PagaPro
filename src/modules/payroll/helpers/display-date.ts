/**
 * dd.mm.yyyy from an ISO timestamp using the UTC calendar date.
 * Avoids hydration mismatches from `toLocaleDateString` differing between Node and the browser.
 */
export function formatIsoDateUtcDdMmYyyy(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const day = d.getUTCDate();
  const month = d.getUTCMonth() + 1;
  const year = d.getUTCFullYear();
  return `${day}.${month}.${year}`;
}
