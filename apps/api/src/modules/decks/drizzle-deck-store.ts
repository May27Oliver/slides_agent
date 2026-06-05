import { Inject, Injectable } from "@nestjs/common";
import { and, desc, eq } from "drizzle-orm";
import type {
  Deck,
  DeckBrief,
  DeckDetail,
  DeckOrigin,
  DeckStore,
  DeckSummary
} from "@slides-agent/domain";
import type { AppDatabase } from "@/infra/db/db.service";
import { DRIZZLE } from "@/infra/db/db.tokens";
import { deckRevisions, decks } from "@/infra/db/schema";

/**
 * Drizzle-backed DeckStore (feature 006). Writes go through a transaction so a
 * deck and its first revision are atomic and `current_revision_id` is set. Reads
 * are always scoped by accountId (ownership isolation).
 */
@Injectable()
export class DrizzleDeckStore implements DeckStore {
  constructor(@Inject(DRIZZLE) private readonly db: AppDatabase) {}

  async saveNewDeck(deck: Deck): Promise<{ deckId: string }> {
    return this.db.transaction(async (tx) => {
      const [deckRow] = await tx
        .insert(decks)
        .values({
          accountId: deck.accountId,
          title: deck.title,
          status: deck.status,
          sourceContent: deck.sourceContent,
          deckBrief: deck.deckBrief
        })
        .returning({ id: decks.id });
      if (!deckRow) {
        throw new Error("Failed to insert deck row");
      }

      const deckId = deckRow.id;

      const [revisionRow] = await tx
        .insert(deckRevisions)
        .values({
          deckId,
          revision: deck.revision.revision,
          slideDeck: deck.revision.slideDeck,
          designPlan: deck.revision.designPlan,
          html: deck.revision.html,
          generationSummary: deck.revision.generationSummary,
          origin: deck.revision.origin,
          sourceJobId: deck.revision.sourceJobId
        })
        .returning({ id: deckRevisions.id });
      if (!revisionRow) {
        throw new Error("Failed to insert deck revision row");
      }

      await tx
        .update(decks)
        .set({ currentRevisionId: revisionRow.id, updatedAt: new Date() })
        .where(eq(decks.id, deckId));

      return { deckId };
    });
  }

  async listByAccount(accountId: string): Promise<DeckSummary[]> {
    const rows = await this.db
      .select({
        id: decks.id,
        title: decks.title,
        status: decks.status,
        updatedAt: decks.updatedAt
      })
      .from(decks)
      .where(eq(decks.accountId, accountId))
      .orderBy(desc(decks.updatedAt));

    return rows.map((row) => ({
      id: row.id,
      title: row.title,
      status: row.status,
      updatedAt: row.updatedAt.toISOString()
    }));
  }

  async findByIdForAccount(accountId: string, deckId: string): Promise<DeckDetail | null> {
    const [deckRow] = await this.db
      .select()
      .from(decks)
      .where(and(eq(decks.id, deckId), eq(decks.accountId, accountId)))
      .limit(1);

    if (!deckRow) {
      return null;
    }

    let currentRevision: DeckDetail["currentRevision"] = null;
    if (deckRow.currentRevisionId) {
      const [revisionRow] = await this.db
        .select()
        .from(deckRevisions)
        .where(eq(deckRevisions.id, deckRow.currentRevisionId))
        .limit(1);
      if (revisionRow) {
        currentRevision = {
          revision: revisionRow.revision,
          slideDeck: revisionRow.slideDeck,
          designPlan: revisionRow.designPlan ?? null,
          html: revisionRow.html,
          generationSummary: revisionRow.generationSummary ?? null,
          origin: revisionRow.origin as DeckOrigin,
          sourceJobId: revisionRow.sourceJobId,
          createdAt: revisionRow.createdAt.toISOString()
        };
      }
    }

    return {
      id: deckRow.id,
      title: deckRow.title,
      status: deckRow.status,
      sourceContent: deckRow.sourceContent,
      deckBrief: deckRow.deckBrief as DeckBrief,
      currentRevision
    };
  }
}
