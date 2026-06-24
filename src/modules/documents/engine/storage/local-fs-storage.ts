import fs from "node:fs/promises";
import path from "node:path";
import type { DocumentStorage, DocumentStoragePutOptions } from "./types";

function assertSafeKey(key: string): void {
  if (!key || key.includes("..") || path.isAbsolute(key)) {
    throw new Error(`Unsafe storage key: ${key}`);
  }
}

/** Filesystem-backed storage — swap for S3 in production. */
export class LocalFsDocumentStorage implements DocumentStorage {
  constructor(private readonly rootDir: string) {}

  private resolve(key: string): string {
    assertSafeKey(key);
    return path.join(this.rootDir, key);
  }

  async put(key: string, body: Buffer, options: DocumentStoragePutOptions): Promise<void> {
    const target = this.resolve(key);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, body);
    void options.contentType;
  }

  async get(key: string): Promise<Buffer> {
    return fs.readFile(this.resolve(key));
  }

  async exists(key: string): Promise<boolean> {
    try {
      await fs.access(this.resolve(key));
      return true;
    } catch {
      return false;
    }
  }
}

/** @deprecated Use LocalFsDocumentStorage */
export class LocalFsContractStorage extends LocalFsDocumentStorage {}
