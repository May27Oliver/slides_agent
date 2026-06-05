import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

// Self-contained (only node:crypto) so the `auth:hash` script can import it by
// relative path without the project's @/ path aliases.
const KEY_LENGTH = 64;
const SALT_BYTES = 16;

/** Produce a `saltHex:hashHex` verifier for a plaintext password (scrypt). */
export function hashPassword(plain: string): string {
  const salt = randomBytes(SALT_BYTES);
  const derived = scryptSync(plain, salt, KEY_LENGTH);
  return `${salt.toString("hex")}:${derived.toString("hex")}`;
}

/** Constant-time verify of a plaintext password against a stored `saltHex:hashHex`. */
export function verifyPassword(plain: string, stored: string): boolean {
  const [saltHex, hashHex] = stored.split(":");
  if (!saltHex || !hashHex) {
    return false;
  }
  const expected = Buffer.from(hashHex, "hex");
  // Always derive the fixed key length so a malformed/short stored hash can't
  // shrink the comparison (and thus the work factor).
  if (expected.length !== KEY_LENGTH) {
    return false;
  }
  const derived = scryptSync(plain, Buffer.from(saltHex, "hex"), KEY_LENGTH);
  return timingSafeEqual(derived, expected);
}
