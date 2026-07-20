import "server-only";

import { StorageClient } from "@supabase/storage-js";
import type { DocumentStorage, DocumentStoragePutOptions } from "./types";
import {
  assertSafeStorageKey,
  contentTypeForKey,
  StorageNotFoundError,
  StorageUnavailableError,
} from "./key-safety";

/**
 * Supabase Storage implementation of DocumentStorage.
 *
 * Holds a service-role credential, so this module is `server-only`. It must never
 * be re-exported from a barrel that a client component can reach.
 *
 * Error contract, matching LocalFsDocumentStorage:
 *   get()    — StorageNotFoundError when absent, StorageUnavailableError otherwise
 *   exists() — false when absent, throws on transient failure
 *   delete() — idempotent; a missing key is not an error
 * Messages are sanitized: several callers interpolate them into user-facing text.
 */
export class SupabaseDocumentStorage implements DocumentStorage {
  private readonly bucket: string;
  private readonly client: StorageClient;

  constructor(params: { url: string; serviceRoleKey: string; bucket: string }) {
    this.bucket = params.bucket;
    const base = params.url.replace(/\/$/, "");
    this.client = new StorageClient(`${base}/storage/v1`, {
      apikey: params.serviceRoleKey,
      Authorization: `Bearer ${params.serviceRoleKey}`,
    });
  }

  private bucketApi() {
    return this.client.from(this.bucket);
  }

  /** Supabase reports a missing object with a 404-ish status or a "not found" message. */
  private static isNotFound(error: { message?: string; statusCode?: string } | null): boolean {
    if (!error) return false;
    const status = String(error.statusCode ?? "");
    if (status === "404" || status === "400") {
      return /not.?found|does not exist|Object not found/i.test(error.message ?? "") || status === "404";
    }
    return /not.?found|does not exist/i.test(error.message ?? "");
  }

  private static fail(operation: string, key: string, detail: unknown): never {
    // Full detail to the server log; the thrown message stays generic because
    // callers interpolate it into Albanian UI strings.
    console.error(`[pagapro] storage ${operation} failed for key ${key}`, detail);
    throw new StorageUnavailableError();
  }

  async put(key: string, body: Buffer, options: DocumentStoragePutOptions): Promise<void> {
    assertSafeStorageKey(key);
    const contentType = options.contentType || contentTypeForKey(key);
    const { error } = await this.bucketApi().upload(key, body, {
      contentType,
      // Regeneration and the backfill both rewrite existing keys.
      upsert: true,
    });
    if (error) SupabaseDocumentStorage.fail("put", key, error);
  }

  async get(key: string): Promise<Buffer> {
    assertSafeStorageKey(key);
    const { data, error } = await this.bucketApi().download(key);
    if (error) {
      if (SupabaseDocumentStorage.isNotFound(error)) throw new StorageNotFoundError();
      SupabaseDocumentStorage.fail("get", key, error);
    }
    if (!data) throw new StorageNotFoundError();
    return Buffer.from(await data.arrayBuffer());
  }

  async exists(key: string): Promise<boolean> {
    assertSafeStorageKey(key);
    // storage-js has no HEAD; list the parent prefix and look for the exact name.
    const slash = key.lastIndexOf("/");
    const prefix = slash === -1 ? "" : key.slice(0, slash);
    const name = slash === -1 ? key : key.slice(slash + 1);

    const { data, error } = await this.bucketApi().list(prefix, { search: name, limit: 100 });
    if (error) SupabaseDocumentStorage.fail("exists", key, error);
    return (data ?? []).some((entry) => entry.name === name);
  }

  async delete(key: string): Promise<void> {
    assertSafeStorageKey(key);
    const { error } = await this.bucketApi().remove([key]);
    // Removing an absent object is a no-op in Supabase, matching the interface's
    // documented idempotency.
    if (error && !SupabaseDocumentStorage.isNotFound(error)) {
      SupabaseDocumentStorage.fail("delete", key, error);
    }
  }
}
