import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { verifyPassword } from "@/common/scrypt-password";

// Repo root (this file is apps/api/test/auth-hash-cli.test.ts).
const repoRoot = fileURLToPath(new URL("../../../", import.meta.url));

/**
 * Smoke test for the `pnpm auth:hash` operator CLI. Spawns the real script the
 * way the npm script does and asserts it prints a usable scrypt `salt:hash` — a
 * regression guard for "forgot to await the now-async hashPassword", which would
 * silently print "[object Promise]" and mint a passwordHash that can never log in.
 */
describe("auth:hash CLI", () => {
  it("prints a scrypt salt:hash that verifies (never [object Promise])", async () => {
    const password = "abc123def4";
    const result = spawnSync("node", ["--import", "tsx", "scripts/auth-hash.ts"], {
      cwd: repoRoot,
      input: `${password}\n`,
      encoding: "utf8"
    });

    expect(result.status).toBe(0);
    const out = result.stdout.trim();
    expect(out).not.toContain("[object Promise]");
    expect(out).toMatch(/^[0-9a-f]+:[0-9a-f]+$/u);
    await expect(verifyPassword(password, out)).resolves.toBe(true);
  }, 20_000);
});
