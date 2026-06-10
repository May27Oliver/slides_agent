import { Inject, Injectable } from "@nestjs/common";
import { and, desc, eq } from "drizzle-orm";
import {
  evaluateAdminMutation,
  type AccountAdminStore,
  type AccountStatus,
  type AdminAccountView,
  type AdminMutationDecision,
  type AdminMutationOutcome,
  type AdminMutationRequest,
  type CreateAccountInput,
  type UserAccount,
  type UserAccountStore
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

  async applyAdminMutation(input: AdminMutationRequest): Promise<AdminMutationOutcome> {
    const { actorId, targetId, status, isAdmin } = input;
    // Demotion, or moving to ANY non-active status, can strip the last admin.
    const stripsManagement = isAdmin === false || (status !== undefined && status !== "active");

    return this.db.transaction(async (tx): Promise<AdminMutationOutcome> => {
      let activeAdminCount = 0;
      if (stripsManagement) {
        // Lock the active-admin set FOR UPDATE so a concurrent demote/disable
        // blocks until this txn commits, then re-reads the reduced count — closing
        // the FR-018 TOCTOU where two admins demoting each other both pass a stale
        // count and drop active admins to zero.
        const lockedAdmins = await tx
          .select({ id: accounts.id })
          .from(accounts)
          .where(and(eq(accounts.isAdmin, true), eq(accounts.status, "active")))
          .for("update");
        activeAdminCount = lockedAdmins.length;
      }

      const [row] = await tx.select().from(accounts).where(eq(accounts.id, targetId)).limit(1);
      if (!row) {
        return { status: "not_found" };
      }
      const target = toAdminAccountView(row);
      const targetIsActiveAdmin = target.isAdmin && target.status === "active";

      const decisions: AdminMutationDecision[] = [];
      if (isAdmin === false) {
        decisions.push(
          evaluateAdminMutation({
            actorId,
            targetId,
            activeAdminCount,
            change: { type: "setAdmin", isAdmin: false, targetIsActiveAdmin }
          })
        );
      }
      if (status !== undefined && status !== "active") {
        decisions.push(
          evaluateAdminMutation({
            actorId,
            targetId,
            activeAdminCount,
            change: { type: "setStatus", status, targetIsActiveAdmin }
          })
        );
      }
      for (const decision of decisions) {
        if (!decision.ok) {
          return { status: "lockout", code: decision.code };
        }
      }

      const patch: Partial<typeof accounts.$inferInsert> = { updatedAt: new Date() };
      if (status !== undefined) {
        patch.status = status;
      }
      if (isAdmin !== undefined) {
        patch.isAdmin = isAdmin;
      }
      const [updated] = await tx
        .update(accounts)
        .set(patch)
        .where(eq(accounts.id, targetId))
        .returning();
      return updated
        ? { status: "ok", account: toAdminAccountView(updated) }
        : { status: "not_found" };
    });
  }

  async deleteById(id: string): Promise<boolean> {
    const deleted = await this.db.delete(accounts).where(eq(accounts.id, id)).returning();
    return deleted.length > 0;
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
