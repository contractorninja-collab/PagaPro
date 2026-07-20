import { normalizeCompanyDomain, normalizeCompanySlug } from "@/lib/company-url";

const RESERVED_SUBDOMAINS = new Set(["admin", "api", "app", "www"]);

function csv(value: string | undefined): string[] {
  return (value ?? "")
    .split(",")
    .map((v) => normalizeCompanyDomain(v))
    .filter(Boolean);
}

export function normalizeRequestHost(host: string | null | undefined): string | null {
  if (!host) return null;
  const first = host.split(",")[0]?.trim();
  if (!first) return null;
  return normalizeCompanyDomain(first);
}

export function tenantRootDomains(): string[] {
  return csv(process.env.PAGAPRO_ROOT_DOMAINS || process.env.PAGAPRO_ROOT_DOMAIN);
}

export function adminHosts(): string[] {
  const explicit = csv(process.env.PAGAPRO_ADMIN_HOSTS || process.env.PAGAPRO_ADMIN_HOST);
  const fromRoots = tenantRootDomains().map((root) => `admin.${root}`);
  return [...new Set([...explicit, ...fromRoots])];
}

export function isAdminHost(host: string | null | undefined): boolean {
  const normalized = normalizeRequestHost(host);
  return Boolean(normalized && adminHosts().includes(normalized));
}

export function tenantSlugFromHost(host: string | null | undefined): string | null {
  const normalized = normalizeRequestHost(host);
  if (!normalized || isAdminHost(normalized)) return null;

  for (const root of tenantRootDomains()) {
    if (normalized === root || normalized === `www.${root}`) return null;
    if (!normalized.endsWith(`.${root}`)) continue;

    const subdomain = normalized.slice(0, -(root.length + 1));
    if (!subdomain || subdomain.includes(".") || RESERVED_SUBDOMAINS.has(subdomain)) return null;
    return normalizeCompanySlug(subdomain) || null;
  }

  return null;
}

export function tenantUrlForCompany(input: { slug: string | null; customDomain: string | null }): string | null {
  if (input.customDomain) return `https://${input.customDomain}`;
  if (!input.slug) return null;

  const root = tenantRootDomains()[0];
  return root ? `https://${input.slug}.${root}` : null;
}
