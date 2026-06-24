export function formatMoneyEUR(amount: string): string {
  const n = Number(String(amount).replace(",", "."));
  if (!Number.isFinite(n)) return amount;
  return `${new Intl.NumberFormat("sq-AL", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n)} €`;
}

/** Legacy alias — same as formatMoneyEUR. */
export function formatMoneyDisplay(amount: string): string {
  return formatMoneyEUR(amount);
}
export function formatTemplateDate(d: Date, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "Europe/Belgrade",
  }).format(d);
}
