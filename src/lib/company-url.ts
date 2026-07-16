const DOMAIN_PROTOCOL_RE = /^https?:\/\//i;

export function normalizeCompanySlug(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export function companySlugFromName(value: string): string {
  return normalizeCompanySlug(value) || "biznes";
}

export function normalizeCompanyDomain(value: string): string {
  const withoutPath =
    value
      .trim()
      .toLowerCase()
      .replace(DOMAIN_PROTOCOL_RE, "")
      .split("/")[0] ?? "";

  return withoutPath
    .trim()
    .replace(/:\d+$/, "")
    .replace(/\.$/, "");
}

export function isValidCompanyDomain(value: string): boolean {
  return /^(?!-)(?:[a-z0-9-]{1,63}\.)+[a-z]{2,63}$/.test(value);
}
