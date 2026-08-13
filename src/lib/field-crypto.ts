import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

/**
 * Application-level encryption for individual sensitive columns — currently
 * bank account numbers. The database is already encrypted at rest by the
 * platform; this layer means a leaked connection string or a stray SQL dump
 * still does not read IBANs.
 *
 * AES-256-GCM, key from FIELD_ENCRYPTION_KEY (base64, 32 bytes). Stored form:
 * `enc1:<iv>:<tag>:<ciphertext>` in base64. Decrypt passes unknown formats
 * through unchanged, so pre-existing plaintext rows keep working during the
 * backfill window and a missing key never turns payroll into an outage.
 */

const PREFIX = "enc1:";

let warned = false;

function loadKey(): Buffer | null {
  const raw = process.env.FIELD_ENCRYPTION_KEY;
  if (!raw) {
    if (!warned && process.env.NODE_ENV === "production") {
      warned = true;
      console.error(
        "[pagapro] FIELD_ENCRYPTION_KEY is not set — sensitive fields are being stored in plaintext.",
      );
    }
    return null;
  }
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) {
    if (!warned) {
      warned = true;
      console.error("[pagapro] FIELD_ENCRYPTION_KEY must be 32 bytes base64 — ignoring it.");
    }
    return null;
  }
  return key;
}

export function isEncryptedField(value: string): boolean {
  return value.startsWith(PREFIX);
}

/** Encrypts when a key is configured; otherwise returns the value unchanged. */
export function encryptField(plain: string): string {
  if (plain === "" || isEncryptedField(plain)) return plain;
  const key = loadKey();
  if (!key) return plain;

  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${PREFIX}${iv.toString("base64")}:${tag.toString("base64")}:${ciphertext.toString("base64")}`;
}

/**
 * Decrypts `enc1:` values; anything else passes through as-is. A wrong key or
 * corrupted row yields a visible placeholder rather than a crash — a payslip
 * with "***" in the bank field is a support ticket, a throwing render is an
 * outage for the whole payroll run.
 */
export function decryptField(stored: string): string {
  if (!isEncryptedField(stored)) return stored;
  const key = loadKey();
  if (!key) return "***";
  try {
    const [ivB64, tagB64, dataB64] = stored.slice(PREFIX.length).split(":");
    if (!ivB64 || !tagB64 || !dataB64) return "***";
    const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(ivB64, "base64"));
    decipher.setAuthTag(Buffer.from(tagB64, "base64"));
    return Buffer.concat([
      decipher.update(Buffer.from(dataB64, "base64")),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    return "***";
  }
}
