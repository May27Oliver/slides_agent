import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import type { BootstrapAccount } from "@slides-agent/domain";
import { seedAccounts } from "@/infra/db/seed-accounts";
import { accounts } from "@/infra/db/schema";
import { createTestDb, type TestDb } from "./helpers/pglite-db";

const acct: BootstrapAccount = {
  id: "user_owner",
  username: "Owner@Example.com",
  displayName: "Owner",
  passwordHash: "salt:hash",
  active: true
};

describe("seedAccounts", () => {
  let testDb: TestDb;

  beforeEach(async () => {
    testDb = await createTestDb();
  });

  afterEach(async () => {
    await testDb.close();
  });

  it("inserts accounts with normalized (lowercase) username, mapping active->status", async () => {
    const count = await seedAccounts(testDb.db, [acct]);
    expect(count).toBe(1);
    const rows = await testDb.db.select().from(accounts);
    expect(rows).toHaveLength(1);
    expect(rows[0].username).toBe("owner@example.com");
    expect(rows[0].status).toBe("active");
    expect(rows[0].isAdmin).toBe(false);
  });

  it("maps active=false to status=disabled and honors isAdmin on first insert", async () => {
    await seedAccounts(testDb.db, [{ ...acct, active: false, isAdmin: true }]);
    const [row] = await testDb.db.select().from(accounts).where(eq(accounts.id, "user_owner"));
    expect(row.status).toBe("disabled");
    expect(row.isAdmin).toBe(true);
  });

  it("is idempotent and updates identity/credentials on re-run (no duplicates)", async () => {
    await seedAccounts(testDb.db, [acct]);
    await seedAccounts(testDb.db, [
      { ...acct, displayName: "Owner v2", passwordHash: "salt2:hash2" }
    ]);
    const rows = await testDb.db.select().from(accounts).where(eq(accounts.id, "user_owner"));
    expect(rows).toHaveLength(1);
    expect(rows[0].displayName).toBe("Owner v2");
    expect(rows[0].passwordHash).toBe("salt2:hash2");
  });

  it("does NOT overwrite status/isAdmin a reseed would otherwise revert (FR-020)", async () => {
    await seedAccounts(testDb.db, [acct]); // status=active, isAdmin=false
    // Simulate an admin promoting + disabling via the dashboard.
    await testDb.db
      .update(accounts)
      .set({ status: "disabled", isAdmin: true })
      .where(eq(accounts.id, "user_owner"));
    // Re-seed with the original env (active=true, no isAdmin).
    await seedAccounts(testDb.db, [acct]);
    const [row] = await testDb.db.select().from(accounts).where(eq(accounts.id, "user_owner"));
    expect(row.status).toBe("disabled"); // preserved, not reverted to active
    expect(row.isAdmin).toBe(true); // preserved, not reverted to false
  });
});
