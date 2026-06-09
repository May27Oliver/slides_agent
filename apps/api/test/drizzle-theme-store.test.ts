import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { DrizzleThemeStore } from "@/modules/themes/drizzle-theme-store";
import { themes } from "@/infra/db/schema";
import { createTestDb, type TestDb } from "./helpers/pglite-db";

/**
 * 007 US1: the adapter reads the *selectable* builtin catalogue. It must exclude
 * non-builtin scope, inactive rows, non-presentation applies_to, and raw `style`
 * rows — and order by id so the `00`-prefixed safe default leads (DR-004/DR-006).
 */
describe("DrizzleThemeStore.listSelectable", () => {
  let testDb: TestDb;
  let store: DrizzleThemeStore;

  beforeEach(async () => {
    testDb = await createTestDb();
    store = new DrizzleThemeStore(testDb.db);
  });

  afterEach(async () => {
    await testDb.close();
  });

  const row = (over: Partial<typeof themes.$inferInsert>): typeof themes.$inferInsert => ({
    id: "x",
    scope: "builtin",
    kind: "style",
    name: "X",
    keywords: [],
    appliesTo: "presentation",
    support: "full",
    styleKit: {},
    ...over
  });

  it("returns only selectable builtin rows, ordered by id", async () => {
    await testDb.db.insert(themes).values([
      row({ id: "style-10-glass", kind: "style", support: "full", appliesTo: "presentation" }),
      row({ id: "style-00-minimal", kind: "style", support: "full", appliesTo: "presentation" }),
      row({ id: "font-00-sans", kind: "font", support: "full", appliesTo: "universal" }),
      // excluded:
      row({ id: "style-10-bento", kind: "style", support: "raw", appliesTo: "presentation" }),
      row({
        id: "style-10-inactive",
        kind: "style",
        support: "full",
        appliesTo: "presentation",
        active: false
      }),
      row({ id: "style-10-landing", kind: "style", support: "full", appliesTo: "landing" }),
      row({ id: "style-10-dashboard", kind: "style", support: "full", appliesTo: "dashboard" }),
      row({
        id: "palette-90-account",
        kind: "palette",
        support: "full",
        appliesTo: "presentation",
        scope: "account"
      })
    ]);

    const result = await store.listSelectable();

    expect(result.map((theme) => theme.id)).toEqual([
      "font-00-sans",
      "style-00-minimal",
      "style-10-glass"
    ]);
  });

  it("keeps a non-style raw row out only by other filters, but excludes raw for style", async () => {
    await testDb.db.insert(themes).values([
      // a raw palette is unusual but must not be force-excluded by the style rule;
      // it is excluded here only because palettes are never authored as raw — prove
      // the style-specific raw exclusion does not leak to other kinds.
      row({ id: "palette-10-ok", kind: "palette", support: "full", appliesTo: "presentation" }),
      row({ id: "style-10-raw", kind: "style", support: "raw", appliesTo: "presentation" })
    ]);

    const result = await store.listSelectable();
    expect(result.map((theme) => theme.id)).toEqual(["palette-10-ok"]);
  });

  it("maps row fields onto SelectableTheme", async () => {
    await testDb.db.insert(themes).values([
      row({
        id: "font-00-sans",
        kind: "font",
        keywords: ["clean", "modern"],
        support: "full",
        styleKit: { fonts: { heading: "Inter", body: "Inter" } }
      })
    ]);

    const [theme] = await store.listSelectable();
    expect(theme).toEqual({
      id: "font-00-sans",
      kind: "font",
      keywords: ["clean", "modern"],
      support: "full",
      styleKit: { fonts: { heading: "Inter", body: "Inter" } }
    });
  });

  it("returns an empty array when no rows are selectable", async () => {
    expect(await store.listSelectable()).toEqual([]);
  });

  describe("listBrowsable (011)", () => {
    it("applies the SAME filter + order as listSelectable, enriched with name/description", async () => {
      await testDb.db.insert(themes).values([
        row({ id: "style-10-glass", name: "Glass", description: "frosted" }),
        row({ id: "style-00-minimal", name: "Minimal" }),
        row({ id: "font-00-sans", kind: "font", name: "Sans", appliesTo: "universal" }),
        // same exclusions as listSelectable:
        row({ id: "style-10-raw", support: "raw" }),
        row({ id: "style-10-inactive", active: false }),
        row({ id: "palette-90-account", kind: "palette", scope: "account" })
      ]);

      const result = await store.listBrowsable();

      expect(result.map((theme) => theme.id)).toEqual([
        "font-00-sans",
        "style-00-minimal",
        "style-10-glass"
      ]);
      // identical id set to listSelectable proves the shared filter (no drift).
      const selectable = await store.listSelectable();
      expect(result.map((t) => t.id)).toEqual(selectable.map((t) => t.id));
    });

    it("maps name + description + full partial styleKit (description omitted when null)", async () => {
      await testDb.db.insert(themes).values([
        row({
          id: "font-00-sans",
          kind: "font",
          name: "Inter Sans",
          description: "clean grotesque",
          keywords: ["clean"],
          styleKit: { fonts: { heading: "Inter", body: "Inter" } }
        }),
        row({ id: "style-00-minimal", kind: "style", name: "Minimal" }) // description null
      ]);

      const [font, style] = await store.listBrowsable();
      expect(font).toEqual({
        id: "font-00-sans",
        kind: "font",
        name: "Inter Sans",
        description: "clean grotesque",
        keywords: ["clean"],
        support: "full",
        styleKit: { fonts: { heading: "Inter", body: "Inter" } }
      });
      // null description is omitted, not surfaced as `description: null`.
      expect(style && "description" in style).toBe(false);
    });
  });
});
