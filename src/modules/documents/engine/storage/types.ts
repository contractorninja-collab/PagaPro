export interface DocumentStoragePutOptions {
  contentType: string;
}

export interface DocumentStorage {
  put(key: string, body: Buffer, options: DocumentStoragePutOptions): Promise<void>;
  get(key: string): Promise<Buffer>;
  exists(key: string): Promise<boolean>;
  /** Remove a blob. Idempotent — a missing key is not an error. */
  delete(key: string): Promise<void>;
}

/** @deprecated Use DocumentStorage */
export type ContractStorage = DocumentStorage;

/** @deprecated Use DocumentStoragePutOptions */
export type ContractStoragePutOptions = DocumentStoragePutOptions;
