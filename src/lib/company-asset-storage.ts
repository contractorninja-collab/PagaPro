import path from "node:path";
import { LocalFsDocumentStorage } from "@/modules/documents/engine/storage/local-fs-storage";

let singleton: LocalFsDocumentStorage | null = null;

/** Local filesystem root — swap bucket prefix for S3-compatible storage in production. */
export function getCompanyAssetStorage(): LocalFsDocumentStorage {
  if (!singleton) {
    const root = process.env.COMPANY_ASSET_STORAGE_ROOT ?? path.join(process.cwd(), ".local-storage", "company-assets");
    singleton = new LocalFsDocumentStorage(root);
  }
  return singleton;
}
