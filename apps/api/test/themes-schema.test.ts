import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { themes } from "@/infra/db/schema";
import { createTestDb, type TestDb } from "./helpers/pglite-db";

/**
 * 006 US4: the `themes` table is created by the same migration as the rest of the
 * schema, but 006 ships it empty — the ui-ux-pro-max seeds land in feature 007.
 * This proves the structure (the seed-ready columns) exists and that no row was
 * inserted, so 007 can rely on the table being present and clean.
 */
describe("themes table structure (reserved for feature 007 seeds)", () => {
  let testDb: TestDb;

  beforeEach(async () => {
    testDb = await createTestDb();
  });

  afterEach(async () => {
    await testDb.close();
  });

  it("exists with the seed-ready columns and starts empty", async () => {
    const result = await testDb.db.execute(
      sql`select column_name from information_schema.columns where table_name = 'themes'`
    );
    const columns = (result.rows as Array<{ column_name: string }>).map((row) => row.column_name);

    expect(columns).toEqual(
      expect.arrayContaining([
        "id",
        "scope",
        "account_id",
        "name",
        "description",
        "keywords",
        "applies_to",
        "support",
        "style_kit",
        "active",
        "created_at",
        "updated_at"
      ])
    );

    const rows = await testDb.db.select().from(themes);
    expect(rows).toHaveLength(0);
  });

  it("indexes the columns 007 will select themes by", async () => {
    const result = await testDb.db.execute(
      sql`select indexname from pg_indexes where tablename = 'themes'`
    );
    const indexes = (result.rows as Array<{ indexname: string }>).map((row) => row.indexname);

    expect(indexes).toEqual(
      expect.arrayContaining(["themes_scope_idx", "themes_account_idx", "themes_select_idx"])
    );
  });
});
