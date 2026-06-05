import type { UserAccount } from "@slides-agent/domain";
import type { AppDatabase } from "@/infra/db/db.service";
import { accounts } from "@/infra/db/schema";

/**
 * Idempotent upsert of allowlisted accounts into the DB. Username is stored
 * normalized (lowercase) to match DbUserAccountStore lookups. Re-running updates
 * the existing row (by id) rather than creating duplicates. Reusable so both the
 * `db:seed` script and tests share the exact same behavior.
 */
export async function seedAccounts(db: AppDatabase, source: UserAccount[]): Promise<number> {
  for (const account of source) {
    const username = account.username.trim().toLowerCase();
    await db
      .insert(accounts)
      .values({
        id: account.id,
        username,
        displayName: account.displayName,
        passwordHash: account.passwordHash,
        active: account.active
      })
      .onConflictDoUpdate({
        target: accounts.id,
        set: {
          username,
          displayName: account.displayName,
          passwordHash: account.passwordHash,
          active: account.active,
          updatedAt: new Date()
        }
      });
  }
  return source.length;
}
