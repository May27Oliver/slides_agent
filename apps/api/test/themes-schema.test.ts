import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { themes } from "@/infra/db/schema";
import { createTestDb, type TestDb } from "./helpers/pglite-db";

/**
 * 006 US4 reserved the `themes` table (empty). 007 adds the `kind` column
 * (font | palette | style) and rebuilds the selection index to lead with `kind`
 * — see specs/007-design-theme-system/data-model.md (DR-007). This test proves
 * the 007 structure: the seed-ready columns + `kind`, and a selection index
 * covering (kind, applies_to, support).
 */
describe("themes table structure (007: kind column + selection index)", () => {
  let testDb: TestDb;

  beforeEach(async () => {
    testDb = await createTestDb();
  });

  afterEach(async () => {
    await testDb.close();
  });

  it("exists with the seed-ready columns including 007's kind, and starts empty", async () => {
    const result = await testDb.db.execute(
      sql`select column_name from information_schema.columns where table_name = 'themes'`
    );
    const columns = (result.rows as Array<{ column_name: string }>).map((row) => row.column_name);

    expect(columns).toEqual(
      expect.arrayContaining([
        "id",
        "scope",
        "kind",
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

  it("requires kind to be NOT NULL", async () => {
    const result = await testDb.db.execute(
      sql`select is_nullable from information_schema.columns
          where table_name = 'themes' and column_name = 'kind'`
    );
    const [row] = result.rows as Array<{ is_nullable: string }>;
    expect(row?.is_nullable).toBe("NO");
  });

  it("indexes the columns 007 selects themes by, with kind leading", async () => {
    const result = await testDb.db.execute(
      sql`select indexname, indexdef from pg_indexes where tablename = 'themes'`
    );
    const rows = result.rows as Array<{ indexname: string; indexdef: string }>;
    const indexes = rows.map((row) => row.indexname);

    expect(indexes).toEqual(
      expect.arrayContaining(["themes_scope_idx", "themes_account_idx", "themes_select_idx"])
    );

    const selectIdx = rows.find((row) => row.indexname === "themes_select_idx");
    // Selection index leads with kind, then applies_to, then support (DR-007).
    expect(selectIdx?.indexdef).toMatch(/\bkind\b.*\bapplies_to\b.*\bsupport\b/);
  });
});
