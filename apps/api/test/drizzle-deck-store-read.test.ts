import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Deck } from "@slides-agent/domain";
import { DrizzleDeckStore } from "@/modules/decks/drizzle-deck-store";
import { seedAccounts } from "@/infra/db/seed-accounts";
import { createTestDb, type TestDb } from "./helpers/pglite-db";

const makeDeck = (accountId: string, title: string, jobId: string): Deck => ({
  accountId,
  title,
  status: "ready",
  sourceContent: `source for ${title}`,
  deckBrief: { purpose: "p", audience: "a" },
  revision: {
    revision: 1,
    slideDeck: { title, slides: [] },
    designPlan: null,
    html: `<html><!-- ${title} --></html>`,
    generationSummary: null,
    origin: "generation",
    sourceJobId: jobId
  }
});

describe("DrizzleDeckStore reads (ownership isolation)", () => {
  let testDb: TestDb;
  let store: DrizzleDeckStore;

  beforeEach(async () => {
    testDb = await createTestDb();
    await seedAccounts(testDb.db, [
      { id: "user_a", username: "a@e.com", displayName: "A", passwordHash: "s:h", active: true },
      { id: "user_b", username: "b@e.com", displayName: "B", passwordHash: "s:h", active: true }
    ]);
    store = new DrizzleDeckStore(testDb.db);
  });

  afterEach(async () => {
    await testDb.close();
  });

  it("listByAccount returns only the account's decks, newest first", async () => {
    await store.saveNewDeck(makeDeck("user_a", "First", "job_1"));
    await store.saveNewDeck(makeDeck("user_a", "Second", "job_2"));
    await store.saveNewDeck(makeDeck("user_b", "B-only", "job_3"));

    const aDecks = await store.listByAccount("user_a");
    expect(aDecks).toHaveLength(2);
    expect(aDecks.map((d) => d.title)).toEqual(["Second", "First"]);
    expect(aDecks.every((d) => "updatedAt" in d)).toBe(true);

    const bDecks = await store.listByAccount("user_b");
    expect(bDecks.map((d) => d.title)).toEqual(["B-only"]);
  });

  it("findByIdForAccount returns the deck with its current revision for the owner", async () => {
    const { deckId } = await store.saveNewDeck(makeDeck("user_a", "Owned", "job_owned"));

    const detail = await store.findByIdForAccount("user_a", deckId);
    expect(detail).not.toBeNull();
    expect(detail?.title).toBe("Owned");
    expect(detail?.currentRevision?.revision).toBe(1);
    expect(detail?.currentRevision?.origin).toBe("generation");
    expect(detail?.currentRevision?.sourceJobId).toBe("job_owned");
  });

  it("findByIdForAccount returns null when another account owns the deck", async () => {
    const { deckId } = await store.saveNewDeck(makeDeck("user_a", "Private", "job_p"));

    expect(await store.findByIdForAccount("user_b", deckId)).toBeNull();
  });

  it("findByIdForAccount returns null for an unknown id", async () => {
    expect(
      await store.findByIdForAccount("user_a", "00000000-0000-0000-0000-000000000000")
    ).toBeNull();
  });
});
