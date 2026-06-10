import type { BootstrapAccount } from "@slides-agent/domain";
import type { AppDatabase } from "@/infra/db/db.service";
import { accounts } from "@/infra/db/schema";

/**
 * Idempotent upsert of the env allowlist into the DB (FR-020). On FIRST insert the
 * bootstrap `active` boolean maps to the DB `status` (true→active, false→disabled)
 * and `isAdmin` defaults to false. On re-run (`onConflictDoUpdate` by id) only the
 * identity/credential fields are refreshed — `status` and `isAdmin` are NEVER
 * overwritten, so an admin's later dashboard changes survive a reseed (DR-007).
 * Username is stored normalized (lowercase) to match DbUserAccountStore lookups.
 */
export async function seedAccounts(db: AppDatabase, source: BootstrapAccount[]): Promise<number> {
  for (const account of source) {
    const username = account.username.trim().toLowerCase();
    await db
      .insert(accounts)
      .values({
        id: account.id,
        username,
        displayName: account.displayName,
        passwordHash: account.passwordHash,
        status: account.active ? "active" : "disabled",
        isAdmin: account.isAdmin ?? false
      })
      .onConflictDoUpdate({
        target: accounts.id,
        set: {
          username,
          displayName: account.displayName,
          passwordHash: account.passwordHash,
          updatedAt: new Date()
        }
      });
  }
  return source.length;
}
