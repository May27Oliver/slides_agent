import { Inject, Injectable } from "@nestjs/common";
import { and, count, desc, eq } from "drizzle-orm";
import type {
  AccountAdminStore,
  AccountStatus,
  AdminAccountView,
  CreateAccountInput,
  UserAccount,
  UserAccountStore
} from "@slides-agent/domain";
import type { AppDatabase } from "@/infra/db/db.service";
import { DRIZZLE } from "@/infra/db/db.tokens";
import { accounts } from "@/infra/db/schema";

type AccountRow = typeof accounts.$inferSelect;

/**
 * DB-backed accounts store (features 006 + 013). Implements both the read-only
 * {@link UserAccountStore} (auth hot path) and the write/list
 * {@link AccountAdminStore} (registration + admin dashboard) over the single
 * `accounts` table — no second store/table (DR-004). Username lookup is
 * case-normalized (lowercase), matching how accounts are seeded (research.md DR-004).
 */
@Injectable()
export class DbUserAccountStore implements UserAccountStore, AccountAdminStore {
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

  async create(input: CreateAccountInput): Promise<AdminAccountView> {
    const [row] = await this.db
      .insert(accounts)
      .values({
        id: input.id,
        username: normalize(input.username),
        displayName: input.displayName,
        passwordHash: input.passwordHash,
        status: input.status,
        isAdmin: input.isAdmin
      })
      .returning();
    if (!row) {
      throw new Error("Account insert returned no row.");
    }
    return toAdminAccountView(row);
  }

  async listAll(filter?: { status?: AccountStatus }): Promise<AdminAccountView[]> {
    const rows = await this.db
      .select()
      .from(accounts)
      .where(filter?.status ? eq(accounts.status, filter.status) : undefined)
      .orderBy(desc(accounts.createdAt));
    return rows.map(toAdminAccountView);
  }

  async getById(id: string): Promise<AdminAccountView | undefined> {
    const rows = await this.db.select().from(accounts).where(eq(accounts.id, id)).limit(1);
    return rows[0] ? toAdminAccountView(rows[0]) : undefined;
  }

  async updateStatus(id: string, status: AccountStatus): Promise<AdminAccountView | undefined> {
    const [row] = await this.db
      .update(accounts)
      .set({ status, updatedAt: new Date() })
      .where(eq(accounts.id, id))
      .returning();
    return row ? toAdminAccountView(row) : undefined;
  }

  async setAdmin(id: string, isAdmin: boolean): Promise<AdminAccountView | undefined> {
    const [row] = await this.db
      .update(accounts)
      .set({ isAdmin, updatedAt: new Date() })
      .where(eq(accounts.id, id))
      .returning();
    return row ? toAdminAccountView(row) : undefined;
  }

  async deleteById(id: string): Promise<boolean> {
    const deleted = await this.db.delete(accounts).where(eq(accounts.id, id)).returning();
    return deleted.length > 0;
  }

  async countActiveAdmins(): Promise<number> {
    const [row] = await this.db
      .select({ value: count() })
      .from(accounts)
      .where(and(eq(accounts.isAdmin, true), eq(accounts.status, "active")));
    return row?.value ?? 0;
  }
}

function toUserAccount(row: AccountRow): UserAccount {
  return {
    id: row.id,
    username: row.username,
    displayName: row.displayName,
    passwordHash: row.passwordHash,
    status: row.status as AccountStatus,
    isAdmin: row.isAdmin
  };
}

function toAdminAccountView(row: AccountRow): AdminAccountView {
  return {
    id: row.id,
    username: row.username,
    displayName: row.displayName,
    status: row.status as AccountStatus,
    isAdmin: row.isAdmin,
    createdAt: row.createdAt.toISOString()
  };
}

function normalize(username: string): string {
  return username.trim().toLowerCase();
}
