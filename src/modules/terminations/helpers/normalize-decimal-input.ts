export function normalizeOptionalDecimalInput(
  value: string | null | undefined,
): string | undefined {
  const raw = value?.trim();
  return raw ? raw.replace(",", ".") : undefined;
}
