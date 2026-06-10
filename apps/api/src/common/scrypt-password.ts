import { randomBytes, scrypt, timingSafeEqual, type BinaryLike } from "node:crypto";

// Self-contained (only node:crypto) so it can be imported by relative path without
// the project's @/ path aliases.
const KEY_LENGTH = 64;
const SALT_BYTES = 16;
// scrypt cost. N=2^16 follows current OWASP guidance for interactive login.
// maxmem must exceed ~128*N*r bytes (~64MB here) or scrypt throws.
const SCRYPT_PARAMS = { N: 65536, r: 8, p: 1, maxmem: 128 * 1024 * 1024 } as const;

// Async scrypt offloads the ~100ms CPU-bound derivation to libuv's thread pool so
// it never blocks the Node.js event loop (a concurrent burst on login/register
// would otherwise stall every other request). Hand-wrapped (not promisify) so the
// options overload keeps its types.
function scryptAsync(password: BinaryLike, salt: BinaryLike, keylen: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, keylen, SCRYPT_PARAMS, (error, derivedKey) => {
      if (error) {
        reject(error);
      } else {
        resolve(derivedKey);
      }
    });
  });
}

/** Produce a `saltHex:hashHex` verifier for a plaintext password (scrypt). */
export async function hashPassword(plain: string): Promise<string> {
  const salt = randomBytes(SALT_BYTES);
  const derived = await scryptAsync(plain, salt, KEY_LENGTH);
  return `${salt.toString("hex")}:${derived.toString("hex")}`;
}

/** Constant-time verify of a plaintext password against a stored `saltHex:hashHex`. */
export async function verifyPassword(plain: string, stored: string): Promise<boolean> {
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
  const derived = await scryptAsync(plain, Buffer.from(saltHex, "hex"), KEY_LENGTH);
  return timingSafeEqual(derived, expected);
}
