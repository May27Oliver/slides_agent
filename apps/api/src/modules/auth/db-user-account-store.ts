import { Inject, Injectable } from "@nestjs/common";
import { eq } from "drizzle-orm";
import type { UserAccount, UserAccountStore } from "@slides-agent/domain";
import type { AppDatabase } from "@/infra/db/db.service";
import { DRIZZLE } from "@/infra/db/db.tokens";
import { accounts } from "@/infra/db/schema";

type AccountRow = typeof accounts.$inferSelect;

/**
 * DB-backed account lookup (feature 006). Implements the same UserAccountStore
 * port as ConfiguredUserAccountStore, so AuthService / Passport strategies / the
 * domain policy are unchanged — only the source of accounts moves to PostgreSQL.
 * Username lookup is case-normalized (lowercase), matching how accounts are
 * seeded (research.md DR-004).
 */
@Injectable()
export class DbUserAccountStore implements UserAccountStore {
  constructor(@Inject(DRIZZLE) private readonly db: AppDatabase) {}

  async findByUsername(username: string): Promise<UserAccount | undefined> {
    const rows = await this.db
      .select()
      .from(accounts)
      .where(eq(accounts.username, normalize(username)))
      .limit(1);
    return rows[0] ? toUserAccount(rows[0]) : undefined;
  }

  async findById(id: string): Promise<UserAccount | undefined> {
    const rows = await this.db.select().from(accounts).where(eq(accounts.id, id)).limit(1);
    return rows[0] ? toUserAccount(rows[0]) : undefined;
  }
}

function toUserAccount(row: AccountRow): UserAccount {
  return {
    id: row.id,
    username: row.username,
    displayName: row.displayName,
    passwordHash: row.passwordHash,
    active: row.active
  };
}

function normalize(username: string): string {
  return username.trim().toLowerCase();
}
