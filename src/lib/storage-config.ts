/**
 * Which blob backend the app uses, resolved once per process.
 *
 * `local` is the default so development and tests are byte-identical to the
 * pre-Supabase behaviour. Switching to `supabase` is explicit: the bucket name
 * must be set. Vercel's Supabase integration auto-injects SUPABASE_URL and
 * SUPABASE_SERVICE_ROLE_KEY, so keying the switch on those alone would flip
 * storage over on an unrelated deploy and 500 every historical download.
 */
export type StorageDriver = "local" | "supabase";

export interface SupabaseStorageConfig {
  driver: "supabase";
  url: string;
  serviceRoleKey: string;
  bucket: string;
}

export interface LocalStorageConfig {
  driver: "local";
  root: string;
}

export type StorageConfig = SupabaseStorageConfig | LocalStorageConfig;

function localRoot(): string {
  return (
    process.env.COMPANY_ASSET_STORAGE_ROOT?.trim() ||
    `${process.cwd()}/.local-storage/company-assets`
  );
}

export function resolveStorageConfig(): StorageConfig {
  const explicit = process.env.PAGAPRO_STORAGE_DRIVER?.trim().toLowerCase();
  const url = process.env.SUPABASE_URL?.trim();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  const bucket = process.env.PAGAPRO_STORAGE_BUCKET?.trim();

  const complete = Boolean(url && serviceRoleKey && bucket);

  if (explicit === "local") return { driver: "local", root: localRoot() };

  // An explicit request for supabase must never silently degrade to the local
  // filesystem — on Vercel that means writing to a read-only disk.
  if (explicit === "supabase" && !complete) {
    throw new Error(
      "PAGAPRO_STORAGE_DRIVER=supabase requires SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and PAGAPRO_STORAGE_BUCKET.",
    );
  }

  if (complete) {
    return {
      driver: "supabase",
      url: url!,
      serviceRoleKey: serviceRoleKey!,
      bucket: bucket!,
    };
  }

  return { driver: "local", root: localRoot() };
}

export function describeStorageConfig(config: StorageConfig): string {
  if (config.driver === "supabase") {
    let host = "?";
    try {
      host = new URL(config.url).hostname;
    } catch {
      /* keep the placeholder — never surface a malformed URL */
    }
    return `supabase (bucket=${config.bucket}, host=${host})`;
  }
  return `local (${config.root})`;
}
