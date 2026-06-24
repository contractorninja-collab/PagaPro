import { cookies } from "next/headers";

/** Cookie set by auth / company switcher — never trust client-sent company IDs in payloads. */
export const ACTIVE_COMPANY_COOKIE = "pp_active_company_id";

/**
 * Resolves the tenant company for the current request.
 * Precedence: `pp_active_company_id` cookie → `DEV_DEFAULT_COMPANY_ID` env (local only).
 */
export async function resolveActiveCompanyId(): Promise<string | null> {
  const jar = await cookies();
  const fromCookie = jar.get(ACTIVE_COMPANY_COOKIE)?.value?.trim();
  if (fromCookie) return fromCookie;

  const fallback = process.env.DEV_DEFAULT_COMPANY_ID?.trim();
  if (fallback) return fallback;

  return null;
}

/** Validates that a storage key belongs to the given company (prefix gate). */
export function assertCompanyScopedStorageKey(companyId: string, key: string): void {
  const prefix = `companies/${companyId}/`;
  if (!key.startsWith(prefix)) {
    throw new Error("Storage key does not belong to active company");
  }
}
