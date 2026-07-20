/** One path segment: no separators, no traversal, no percent-encoding tricks. */
const SAFE_SEGMENT_RE = /^[A-Za-z0-9._-]+$/;

const MAX_KEY_LENGTH = 1024;

/**
 * Stable, sanitized storage errors.
 *
 * Messages NEVER carry the endpoint, bucket, credentials, or the key. Six call
 * sites interpolate a caught `e.message` straight into user-facing Albanian
 * strings (documents-actions.ts x2, atk-payroll-export-service.ts,
 * payroll-pdf-service.ts, report-generation-service.ts,
 * generate-termination-document.ts), so detail belongs in console.error only.
 */
export class StorageKeyError extends Error {
  readonly code = "STORAGE_INVALID_KEY";
  constructor() {
    super("Çelës i pavlefshëm i ruajtjes.");
    this.name = "StorageKeyError";
  }
}

export class StorageNotFoundError extends Error {
  readonly code = "STORAGE_NOT_FOUND";
  constructor() {
    super("Skedari nuk u gjet në ruajtje.");
    this.name = "StorageNotFoundError";
  }
}

export class StorageUnavailableError extends Error {
  readonly code = "STORAGE_UNAVAILABLE";
  constructor() {
    super("Ruajtja e skedarëve nuk është e disponueshme.");
    this.name = "StorageUnavailableError";
  }
}

/**
 * True when `key` is a canonical, traversal-free storage key.
 *
 * Stricter than the original module-private `assertSafeKey`, which rejected only
 * empty / ".." / absolute paths. Checked against every key builder in the repo —
 * path-keys.ts, payroll-path-keys.ts, atk-storage-keys.ts,
 * reports/helpers/storage-keys.ts and save-konfigurime.ts — all of which emit
 * cuids, uuids, `v{n}`, DocumentSubjectKind enum values and simple filenames.
 */
export function isSafeStorageKey(key: string): boolean {
  if (!key || key.length > MAX_KEY_LENGTH) return false;
  if (key.startsWith("/") || key.includes("\\")) return false;

  for (const segment of key.split("/")) {
    // "." and ".." BOTH match SAFE_SEGMENT_RE. This explicit check is
    // load-bearing — deleting it as "redundant" silently reopens traversal.
    if (segment === "." || segment === "..") return false;
    if (!SAFE_SEGMENT_RE.test(segment)) return false;
  }
  return true;
}

export function assertSafeStorageKey(key: string): void {
  if (!isSafeStorageKey(key)) throw new StorageKeyError();
}

/** Best-effort content type from a key's extension, for object stores that persist it. */
export function contentTypeForKey(key: string): string {
  const ext = key.slice(key.lastIndexOf(".") + 1).toLowerCase();
  switch (ext) {
    case "docx":
      return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    case "xlsx":
      return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    case "pdf":
      return "application/pdf";
    case "csv":
      return "text/csv; charset=utf-8";
    case "json":
      return "application/json";
    case "png":
      return "image/png";
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "webp":
      return "image/webp";
    default:
      return "application/octet-stream";
  }
}
