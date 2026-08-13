import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { decryptField, encryptField, isEncryptedField } from "@/lib/field-crypto";

const KEY = Buffer.alloc(32, 7).toString("base64");

describe("field-crypto", () => {
  const original = process.env.FIELD_ENCRYPTION_KEY;

  beforeEach(() => {
    process.env.FIELD_ENCRYPTION_KEY = KEY;
  });
  afterEach(() => {
    if (original === undefined) delete process.env.FIELD_ENCRYPTION_KEY;
    else process.env.FIELD_ENCRYPTION_KEY = original;
  });

  it("round-trips an IBAN", () => {
    const stored = encryptField("XK051212001234567890");
    expect(isEncryptedField(stored)).toBe(true);
    expect(stored).not.toContain("1212001234567890");
    expect(decryptField(stored)).toBe("XK051212001234567890");
  });

  it("uses a fresh IV per call — equal plaintexts encrypt differently", () => {
    expect(encryptField("XK05")).not.toBe(encryptField("XK05"));
  });

  it("passes legacy plaintext through decrypt unchanged", () => {
    expect(decryptField("XK051212001234567890")).toBe("XK051212001234567890");
  });

  it("never double-encrypts", () => {
    const once = encryptField("XK05");
    expect(encryptField(once)).toBe(once);
  });

  it("returns a placeholder, not a throw, for a tampered value", () => {
    const stored = encryptField("XK051212001234567890");
    const tampered = stored.slice(0, -4) + "AAAA";
    expect(decryptField(tampered)).toBe("***");
  });

  it("stores plaintext when no key is configured (with decrypt passthrough)", () => {
    delete process.env.FIELD_ENCRYPTION_KEY;
    const stored = encryptField("XK05");
    expect(stored).toBe("XK05");
    expect(decryptField(stored)).toBe("XK05");
  });
});
