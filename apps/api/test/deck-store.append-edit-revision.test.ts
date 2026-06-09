import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import type { Deck, EditRevisionInput } from "@slides-agent/domain";
import { DrizzleDeckStore } from "@/modules/decks/drizzle-deck-store";
import { seedAccounts } from "@/infra/db/seed-accounts";
import { deckRevisions, decks } from "@/infra/db/schema";
import { createTestDb, type TestDb } from "./helpers/pglite-db";

const baseDeck: Deck = {
  accountId: "user_owner",
  title: "Q2 Review",
  status: "ready",
  sourceContent: "raw source",
  deckBrief: { purpose: "p", audience: "a" },
  revision: {
    revision: 1,
    slideDeck: { title: "Q2 Review", slides: [{ id: "s1" }] },
    designPlan: { designSystem: {} },
    html: "<gen/>",
    generationSummary: { slideCount: 1 },
    chartIntents: [{ id: "chart-0" }],
    origin: "generation",
    sourceJobId: "preview_job_1"
  }
};

const editPayload: EditRevisionInput = {
  slideDeck: { title: "Q2 Review", slides: [{ id: "s1", title: "edited" }] },
  designPlan: { designSystem: {} },
  chartIntents: [{ id: "chart-0" }],
  html: "<edit/>",
  generationSummary: { slideCount: 1 },
  origin: "edit",
  sourceJobId: null
};

describe("DrizzleDeckStore.appendEditRevision (010 US1)", () => {
  let testDb: TestDb;
  let store: DrizzleDeckStore;
  let deckId: string;

  beforeEach(async () => {
    testDb = await createTestDb();
    await seedAccounts(testDb.db, [
      {
        id: "user_owner",
        username: "o@e.com",
        displayName: "Owner",
        passwordHash: "s:h",
        active: true
      }
    ]);
    store = new DrizzleDeckStore(testDb.db);
    ({ deckId } = await store.saveNewDeck(baseDeck));
  });

  afterEach(async () => {
    await testDb.close();
  });

  it("appends revision base+1, repoints current_revision_id, keeps the old revision", async () => {
    const result = await store.appendEditRevision("user_owner", deckId, 1, editPayload);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.revision.revision).toBe(2);
    expect(result.revision.origin).toBe("edit");
    expect(result.revision.html).toBe("<edit/>");
    expect(result.revision.chartIntents).toEqual([{ id: "chart-0" }]);

    const revs = await testDb.db
      .select()
      .from(deckRevisions)
      .where(eq(deckRevisions.deckId, deckId));
    expect(revs.map((r) => r.revision).sort()).toEqual([1, 2]); // old revision kept

    const [deckRow] = await testDb.db.select().from(decks).where(eq(decks.id, deckId));
    const [newRev] = revs.filter((r) => r.revision === 2);
    expect(deckRow.currentRevisionId).toBe(newRev.id);
    expect(newRev.chartIntents).toEqual([{ id: "chart-0" }]);
  });

  it("rejects a stale base revision as a conflict and writes nothing", async () => {
    // First edit moves current to revision 2.
    await store.appendEditRevision("user_owner", deckId, 1, editPayload);
    // Second edit still thinks base is 1 → conflict, no new revision.
    const result = await store.appendEditRevision("user_owner", deckId, 1, editPayload);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.conflict).toBe(true);
    expect(result.currentRevision).toBe(2);

    const revs = await testDb.db
      .select()
      .from(deckRevisions)
      .where(eq(deckRevisions.deckId, deckId));
    expect(revs.length).toBe(2); // no third revision written
  });

  it("does not write to another account's deck", async () => {
    await seedAccounts(testDb.db, [
      {
        id: "user_other",
        username: "x@e.com",
        displayName: "Other",
        passwordHash: "s:h",
        active: true
      }
    ]);
    // Wrong owner → no matching row → throws (caller pre-checks 404). Nothing written.
    await expect(
      store.appendEditRevision("user_other", deckId, 1, editPayload)
    ).rejects.toThrow();

    const revs = await testDb.db
      .select()
      .from(deckRevisions)
      .where(eq(deckRevisions.deckId, deckId));
    expect(revs.length).toBe(1);
  });
});
