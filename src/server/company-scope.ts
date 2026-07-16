import { cookies } from "next/headers";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { isAdminHost, normalizeRequestHost, tenantSlugFromHost } from "@/server/tenant-domain";

/** Cookie set by auth / company switcher — never trust client-sent company IDs in payloads. */
export const ACTIVE_COMPANY_COOKIE = "pp_active_company_id";

/**
 * Resolves the tenant company for the current request.
 * Precedence: tenant host/domain → `pp_active_company_id` cookie → `DEV_DEFAULT_COMPANY_ID` env (local only).
 */
export async function resolveActiveCompanyId(): Promise<string | null> {
  const fromHost = await resolveRequestCompanyIdFromHost();
  if (fromHost) return fromHost;

  const jar = await cookies();
  const fromCookie = jar.get(ACTIVE_COMPANY_COOKIE)?.value?.trim();
  if (fromCookie) return fromCookie;

  if (process.env.NODE_ENV !== "development" && process.env.NODE_ENV !== "test") return null;

  const fallback = process.env.DEV_DEFAULT_COMPANY_ID?.trim();
  if (fallback) return fallback;

  return null;
}

export async function resolveRequestHost(): Promise<string | null> {
  const hdrs = await headers();
  return normalizeRequestHost(hdrs.get("x-forwarded-host") ?? hdrs.get("host"));
}

export async function resolveRequestCompanyIdFromHost(): Promise<string | null> {
  const host = await resolveRequestHost();
  if (!host || isAdminHost(host)) return null;

  const slug = tenantSlugFromHost(host);
  const company = await prisma.company.findFirst({
    where: {
      status: "ACTIVE",
      OR: [
        ...(slug ? [{ slug }] : []),
        { customDomain: host },
      ],
    },
    select: { id: true },
  });

  return company?.id ?? null;
}

/** Validates that a storage key belongs to the given company (prefix gate). */
export function assertCompanyScopedStorageKey(companyId: string, key: string): void {
  const prefix = `companies/${companyId}/`;
  if (!key.startsWith(prefix)) {
    throw new Error("Storage key does not belong to active company");
  }
}
