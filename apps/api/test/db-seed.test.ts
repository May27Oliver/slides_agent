import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import type { UserAccount } from "@slides-agent/domain";
import { seedAccounts } from "@/infra/db/seed-accounts";
import { accounts } from "@/infra/db/schema";
import { createTestDb, type TestDb } from "./helpers/pglite-db";

const acct: UserAccount = {
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

  it("inserts accounts with normalized (lowercase) username", async () => {
    const count = await seedAccounts(testDb.db, [acct]);
    expect(count).toBe(1);
    const rows = await testDb.db.select().from(accounts);
    expect(rows).toHaveLength(1);
    expect(rows[0].username).toBe("owner@example.com");
  });

  it("is idempotent and updates on re-run (no duplicates)", async () => {
    await seedAccounts(testDb.db, [acct]);
    await seedAccounts(testDb.db, [
      { ...acct, displayName: "Owner v2", passwordHash: "salt2:hash2" }
    ]);
    const rows = await testDb.db.select().from(accounts).where(eq(accounts.id, "user_owner"));
    expect(rows).toHaveLength(1);
    expect(rows[0].displayName).toBe("Owner v2");
    expect(rows[0].passwordHash).toBe("salt2:hash2");
  });
});
