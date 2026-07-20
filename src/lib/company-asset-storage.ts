import { LocalFsDocumentStorage } from "@/modules/documents/engine/storage/local-fs-storage";
import { SupabaseDocumentStorage } from "@/modules/documents/engine/storage/supabase-storage";
import type { DocumentStorage } from "@/modules/documents/engine/storage/types";
import { describeStorageConfig, resolveStorageConfig } from "@/lib/storage-config";

let singleton: DocumentStorage | null = null;

/**
 * The blob store for every company asset — templates, generated artifacts,
 * payroll PDFs, ATK exports, reports and konfigurime images.
 *
 * Returns the DocumentStorage interface rather than a concrete class so the
 * backend can be swapped by configuration. Defaults to the local filesystem;
 * set SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and PAGAPRO_STORAGE_BUCKET to use
 * Supabase Storage (required on serverless, where the FS is read-only and the
 * bundle carries no seeded blobs).
 */
export function getCompanyAssetStorage(): DocumentStorage {
  if (!singleton) {
    const config = resolveStorageConfig();
    console.log(`[pagapro] storage driver: ${describeStorageConfig(config)}`);

    if (config.driver === "supabase") {
      singleton = new SupabaseDocumentStorage({
        url: config.url,
        serviceRoleKey: config.serviceRoleKey,
        bucket: config.bucket,
      });
    } else {
      if (process.env.VERCEL) {
        console.warn(
          "[pagapro] storage is on the local filesystem inside a serverless function — " +
            "reads of seeded blobs will ENOENT and writes will fail. Set PAGAPRO_STORAGE_BUCKET.",
        );
      }
      singleton = new LocalFsDocumentStorage(config.root);
    }
  }
  return singleton;
}

/** Best-effort blob removal for storage reclaim — never throws (GC must not break a request). */
export async function safeDeleteAsset(key: string | null | undefined): Promise<void> {
  if (!key) return;
  try {
    await getCompanyAssetStorage().delete(key);
  } catch (err) {
    console.error("[pagapro] asset delete failed for key", key, err);
  }
}
