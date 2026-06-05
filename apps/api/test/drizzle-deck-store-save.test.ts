import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import type { Deck } from "@slides-agent/domain";
import { DrizzleDeckStore } from "@/modules/decks/drizzle-deck-store";
import { seedAccounts } from "@/infra/db/seed-accounts";
import { deckRevisions, decks } from "@/infra/db/schema";
import { createTestDb, type TestDb } from "./helpers/pglite-db";

const deck: Deck = {
  accountId: "user_owner",
  title: "Q2 Review",
  status: "ready",
  sourceContent: "raw source",
  deckBrief: { purpose: "p", audience: "a" },
  revision: {
    revision: 1,
    slideDeck: { title: "Q2 Review", slides: [] },
    designPlan: { designSystem: {} },
    html: "<html></html>",
    generationSummary: { slideCount: 3 },
    origin: "generation",
    sourceJobId: "preview_job_1"
  }
};

describe("DrizzleDeckStore.saveNewDeck", () => {
  let testDb: TestDb;
  let store: DrizzleDeckStore;

  beforeEach(async () => {
    testDb = await createTestDb();
    await seedAccounts(testDb.db, [
      { id: "user_owner", username: "o@e.com", displayName: "Owner", passwordHash: "s:h", active: true }
    ]);
    store = new DrizzleDeckStore(testDb.db);
  });

  afterEach(async () => {
    await testDb.close();
  });

  it("creates a deck + first revision atomically and sets current_revision_id", async () => {
    const { deckId } = await store.saveNewDeck(deck);
    expect(deckId).toBeTruthy();

    const [deckRow] = await testDb.db.select().from(decks).where(eq(decks.id, deckId));
    expect(deckRow.accountId).toBe("user_owner");
    expect(deckRow.title).toBe("Q2 Review");
    expect(deckRow.currentRevisionId).toBeTruthy();

    const [rev] = await testDb.db
      .select()
      .from(deckRevisions)
      .where(eq(deckRevisions.deckId, deckId));
    expect(rev.revision).toBe(1);
    expect(rev.origin).toBe("generation");
    expect(rev.sourceJobId).toBe("preview_job_1");
    expect(rev.html).toBe("<html></html>");
    expect(deckRow.currentRevisionId).toBe(rev.id);
  });
});
