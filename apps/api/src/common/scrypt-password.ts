import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

// Self-contained (only node:crypto) so the `auth:hash` script can import it by
// relative path without the project's @/ path aliases.
const KEY_LENGTH = 64;
const SALT_BYTES = 16;
// scrypt cost. N=2^16 follows current OWASP guidance for interactive login.
// maxmem must exceed ~128*N*r bytes (~64MB here) or scryptSync throws.
const SCRYPT_PARAMS = { N: 65536, r: 8, p: 1, maxmem: 128 * 1024 * 1024 } as const;

/** Produce a `saltHex:hashHex` verifier for a plaintext password (scrypt). */
export function hashPassword(plain: string): string {
  const salt = randomBytes(SALT_BYTES);
  const derived = scryptSync(plain, salt, KEY_LENGTH, SCRYPT_PARAMS);
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
  const derived = scryptSync(plain, Buffer.from(saltHex, "hex"), KEY_LENGTH, SCRYPT_PARAMS);
  return timingSafeEqual(derived, expected);
}
