import { randomBytes, randomInt } from "node:crypto";
import bcrypt from "bcryptjs";

const BCRYPT_ROUNDS = 12;

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_ROUNDS);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

/** Unambiguous alphabet (no 0/O, 1/l/I) — temp passwords get copied by hand. */
const TEMP_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";

/**
 * Crypto-random temporary password, e.g. `Xk4t-Rm9w-Pq2z`.
 * Shown once in the admin console; the user must rotate it on first login.
 */
export function generateTempPassword(): string {
  const block = () =>
    Array.from({ length: 4 }, () => TEMP_ALPHABET[randomInt(TEMP_ALPHABET.length)]).join("");
  return `${block()}-${block()}-${block()}`;
}

/** Raw session token for the cookie — only its sha256 hash is persisted. */
export function generateSessionToken(): string {
  return randomBytes(32).toString("hex");
}
