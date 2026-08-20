import type { EmployeeDocumentCategory } from "@prisma/client";

/**
 * Pure file rules for uploaded employee documents. No IO — everything here is
 * unit-tested, because these checks are the security boundary: the declared
 * MIME type of an upload is client input and is never trusted on its own.
 */

export const MAX_EMPLOYEE_DOCUMENT_BYTES = 10 * 1024 * 1024;

/** Validated MIME → canonical storage extension. */
export const ALLOWED_EMPLOYEE_DOCUMENT_MIME: Record<string, string> = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
};

/**
 * Magic-byte verification: the file's leading bytes must match its declared
 * type. A spoofed extension or Content-Type fails here regardless of what the
 * browser claimed. DOCX is a ZIP container, so it shares the PK signature —
 * that is as far as byte-sniffing can take a ZIP, and why uploaded DOCX is
 * served as attachment-only and never fed to the PDF converter.
 */
export function matchesDeclaredMime(bytes: Uint8Array, declaredMime: string): boolean {
  const b = bytes;
  switch (declaredMime) {
    case "application/pdf":
      return b.length > 4 && b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46; // %PDF
    case "image/jpeg":
      return b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff;
    case "image/png":
      return (
        b.length > 8 &&
        b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 &&
        b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a
      );
    case "image/webp":
      return (
        b.length > 12 &&
        b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && // RIFF
        b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50 // WEBP
      );
    case "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
      return b.length > 4 && b[0] === 0x50 && b[1] === 0x4b && (b[2] === 0x03 || b[2] === 0x05) ; // PK
    default:
      return false;
  }
}

/**
 * The storage key contains no user input: server uuid + extension derived from
 * the VALIDATED MIME. The companies/{companyId}/ prefix is what
 * assertCompanyScopedStorageKey() guards at serve time.
 */
export function buildEmployeeDocumentStorageKey(
  companyId: string,
  employeeId: string,
  validatedMime: string,
): string {
  const ext = ALLOWED_EMPLOYEE_DOCUMENT_MIME[validatedMime];
  if (!ext) throw new Error(`unsupported mime: ${validatedMime}`);
  // globalThis.crypto works in Node 18+ and the browser — this module is
  // imported by client components for its constants, so no node: builtins.
  return `companies/${companyId}/employees/${employeeId}/documents/${globalThis.crypto.randomUUID()}.${ext}`;
}

/** Display/Content-Disposition only — never part of a key or path. */
export function sanitizeDisplayFilename(raw: string): string {
  const trimmed = raw.replace(/[/\\]+/g, " ").replace(/[\x00-\x1f]/g, "").trim();
  const compact = trimmed.replace(/\s+/g, " ");
  const bounded = compact.length > 140 ? compact.slice(0, 140) : compact;
  return bounded === "" || bounded === "." || bounded === ".." ? "dokument" : bounded;
}

/** PDFs and images may render inline; everything else downloads. */
export function isInlinePreviewable(contentType: string): boolean {
  return contentType === "application/pdf" || contentType.startsWith("image/");
}

/**
 * Special-category personal data (Kosovo LMDhP 06/L-082) — visible only with
 * the documents.sensitive capability, enforced in the list service, the serve
 * route and the UI.
 */
export const SENSITIVE_EMPLOYEE_DOCUMENT_CATEGORIES: readonly EmployeeDocumentCategory[] = [
  "MJEKESORE",
  "DISIPLINORE",
];

export function isSensitiveCategory(category: EmployeeDocumentCategory): boolean {
  return SENSITIVE_EMPLOYEE_DOCUMENT_CATEGORIES.includes(category);
}
