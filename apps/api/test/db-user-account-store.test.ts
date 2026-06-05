import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { UserAccount } from "@slides-agent/domain";
import { DbUserAccountStore } from "@/modules/auth/db-user-account-store";
import { seedAccounts } from "@/infra/db/seed-accounts";
import { createTestDb, type TestDb } from "./helpers/pglite-db";

const owner: UserAccount = {
  id: "user_owner",
  username: "Owner@Example.com",
  displayName: "Owner",
  passwordHash: "salt:hash",
  active: true
};
const disabled: UserAccount = {
  id: "user_disabled",
  username: "disabled@example.com",
  displayName: "Disabled",
  passwordHash: "salt:hash",
  active: false
};

describe("DbUserAccountStore", () => {
  let testDb: TestDb;
  let store: DbUserAccountStore;

  beforeEach(async () => {
    testDb = await createTestDb();
    await seedAccounts(testDb.db, [owner, disabled]);
    store = new DbUserAccountStore(testDb.db);
  });

  afterEach(async () => {
    await testDb.close();
  });

  it("finds by username case-insensitively", async () => {
    const found = await store.findByUsername("OWNER@EXAMPLE.COM");
    expect(found?.id).toBe("user_owner");
    expect(found?.username).toBe("owner@example.com");
  });

  it("finds by id", async () => {
    expect((await store.findById("user_owner"))?.username).toBe("owner@example.com");
  });

  it("returns inactive accounts (active=false) for the policy to reject", async () => {
    const found = await store.findById("user_disabled");
    expect(found?.active).toBe(false);
  });

  it("returns undefined for unknown username/id", async () => {
    expect(await store.findByUsername("nobody@example.com")).toBeUndefined();
    expect(await store.findById("user_missing")).toBeUndefined();
  });
});
