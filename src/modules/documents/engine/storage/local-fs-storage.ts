import fs from "node:fs/promises";
import path from "node:path";
import type { DocumentStorage, DocumentStoragePutOptions } from "./types";
import { assertSafeStorageKey, StorageNotFoundError } from "./key-safety";

function isEnoent(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    (err as NodeJS.ErrnoException).code === "ENOENT"
  );
}

/** Filesystem-backed storage — the local-dev fallback for SupabaseDocumentStorage. */
export class LocalFsDocumentStorage implements DocumentStorage {
  constructor(private readonly rootDir: string) {}

  private resolve(key: string): string {
    // Shared with the Supabase adapter — one guard, no bypass, throws StorageKeyError.
    assertSafeStorageKey(key);
    return path.join(this.rootDir, key);
  }

  async put(key: string, body: Buffer, options: DocumentStoragePutOptions): Promise<void> {
    const target = this.resolve(key);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, body);
    // The filesystem has nowhere to persist a content type; every download route
    // sets its own header, so this stays a no-op and local behaviour is unchanged.
    void options.contentType;
  }

  async get(key: string): Promise<Buffer> {
    try {
      return await fs.readFile(this.resolve(key));
    } catch (err) {
      // Match the object-store contract so callers branch on one error type.
      // Without this a missing file surfaces as a raw ENOENT 500 locally while
      // the same request 404s in production.
      if (isEnoent(err)) throw new StorageNotFoundError();
      throw err;
    }
  }

  async exists(key: string): Promise<boolean> {
    try {
      await fs.access(this.resolve(key));
      return true;
    } catch {
      return false;
    }
  }

  async delete(key: string): Promise<void> {
    await fs.rm(this.resolve(key), { force: true });
  }
}

/** @deprecated Use LocalFsDocumentStorage */
export class LocalFsContractStorage extends LocalFsDocumentStorage {}
