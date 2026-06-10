import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { BootstrapAccount } from "@slides-agent/domain";
import { DbUserAccountStore } from "@/modules/auth/db-user-account-store";
import { seedAccounts } from "@/infra/db/seed-accounts";
import { createTestDb, type TestDb } from "./helpers/pglite-db";

const owner: BootstrapAccount = {
  id: "user_owner",
  username: "Owner@Example.com",
  displayName: "Owner",
  passwordHash: "salt:hash",
  active: true,
  isAdmin: true
};
const disabled: BootstrapAccount = {
  id: "user_disabled",
  username: "disabled@example.com",
  displayName: "Disabled",
  passwordHash: "salt:hash",
  active: false
};

describe("DbUserAccountStore (read path)", () => {
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

  it("finds by username case-insensitively, carrying status + isAdmin", async () => {
    const found = await store.findByUsername("OWNER@EXAMPLE.COM");
    expect(found?.id).toBe("user_owner");
    expect(found?.username).toBe("owner@example.com");
    expect(found?.status).toBe("active");
    expect(found?.isAdmin).toBe(true);
  });

  it("finds by id", async () => {
    expect((await store.findById("user_owner"))?.username).toBe("owner@example.com");
  });

  it("returns disabled accounts (status='disabled') for the policy to reject", async () => {
    const found = await store.findById("user_disabled");
    expect(found?.status).toBe("disabled");
  });

  it("returns undefined for unknown username/id", async () => {
    expect(await store.findByUsername("nobody@example.com")).toBeUndefined();
    expect(await store.findById("user_missing")).toBeUndefined();
  });
});

describe("DbUserAccountStore (admin/write path)", () => {
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

  it("creates a pending account, normalizing the username, omitting the hash", async () => {
    const view = await store.create({
      id: "user_new",
      username: "New.User@Example.com",
      displayName: "New User",
      passwordHash: "salt:hash",
      status: "pending",
      isAdmin: false
    });
    expect(view).toMatchObject({
      id: "user_new",
      username: "new.user@example.com",
      status: "pending",
      isAdmin: false
    });
    expect(view).not.toHaveProperty("passwordHash");
    expect(typeof view.createdAt).toBe("string");
  });

  it("lists all accounts (newest first) and filters by status", async () => {
    const all = await store.listAll();
    expect(all.map((u) => u.id).sort()).toEqual(["user_disabled", "user_owner"]);
    const onlyDisabled = await store.listAll({ status: "disabled" });
    expect(onlyDisabled.map((u) => u.id)).toEqual(["user_disabled"]);
  });

  it("getById returns a hash-free view or undefined", async () => {
    expect((await store.getById("user_owner"))?.isAdmin).toBe(true);
    expect(await store.getById("user_missing")).toBeUndefined();
  });

  it("updates status and isAdmin, returning the new view", async () => {
    expect((await store.updateStatus("user_disabled", "active"))?.status).toBe("active");
    expect((await store.setAdmin("user_disabled", true))?.isAdmin).toBe(true);
    expect(await store.updateStatus("user_missing", "active")).toBeUndefined();
  });

  it("deletes by id, reporting whether a row was removed", async () => {
    expect(await store.deleteById("user_disabled")).toBe(true);
    expect(await store.deleteById("user_disabled")).toBe(false);
    expect(await store.findById("user_disabled")).toBeUndefined();
  });

  it("counts only active admins", async () => {
    expect(await store.countActiveAdmins()).toBe(1); // owner is an active admin
    await store.updateStatus("user_owner", "disabled");
    expect(await store.countActiveAdmins()).toBe(0); // disabled admin no longer counts
  });
});
