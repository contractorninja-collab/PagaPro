const FALLBACK_ADMIN_BASE_PATH = "/admin-console";
const RESERVED_PATHS = new Set([
  "/admin",
  "/api",
  "/auth",
  "/hyrje",
  "/paneli",
]);

export function normalizeAdminBasePath(value: string | null | undefined): string {
  const candidate = `/${(value ?? "").trim().replace(/^\/+|\/+$/g, "")}`.toLowerCase();

  if (
    !/^\/[a-z0-9](?:[a-z0-9-]{0,78}[a-z0-9])?$/.test(candidate) ||
    RESERVED_PATHS.has(candidate)
  ) {
    return FALLBACK_ADMIN_BASE_PATH;
  }

  return candidate;
}

export const ADMIN_BASE_PATH = normalizeAdminBasePath(
  process.env.NEXT_PUBLIC_PAGAPRO_ADMIN_PATH,
);

export function adminPath(suffix = ""): string {
  const normalizedSuffix = suffix ? `/${suffix.replace(/^\/+/, "")}` : "";
  return `${ADMIN_BASE_PATH}${normalizedSuffix}`;
}

export function isAdminPublicPathname(pathname: string): boolean {
  return pathname === ADMIN_BASE_PATH || pathname.startsWith(`${ADMIN_BASE_PATH}/`);
}
