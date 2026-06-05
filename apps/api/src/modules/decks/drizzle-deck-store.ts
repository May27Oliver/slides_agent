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

// Defensive upper bound on the un-paginated "my decks" list so a single account
// with an unexpectedly large number of decks can't trigger a huge scan/payload.
// Pagination proper is a later enhancement (the contract documents "not paginated").
const LIST_LIMIT = 200;

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
      .orderBy(desc(decks.updatedAt))
      .limit(LIST_LIMIT);

    return rows.map((row) => ({
      id: row.id,
      title: row.title,
      status: row.status,
      updatedAt: row.updatedAt.toISOString()
    }));
  }

  async findByIdForAccount(accountId: string, deckId: string): Promise<DeckDetail | null> {
    // One round-trip: the deck row (scoped to the owner) left-joined to its
    // current revision. The join is keyed on BOTH ids, so a `current_revision_id`
    // that ever pointed at another deck's revision (corruption / bad migration)
    // would yield a null revision here rather than leaking foreign content.
    const [row] = await this.db
      .select({ deck: decks, revision: deckRevisions })
      .from(decks)
      .leftJoin(
        deckRevisions,
        and(eq(deckRevisions.id, decks.currentRevisionId), eq(deckRevisions.deckId, decks.id))
      )
      .where(and(eq(decks.id, deckId), eq(decks.accountId, accountId)))
      .limit(1);

    if (!row) {
      return null;
    }

    const { deck: deckRow, revision: revisionRow } = row;

    return {
      id: deckRow.id,
      title: deckRow.title,
      status: deckRow.status,
      sourceContent: deckRow.sourceContent,
      deckBrief: deckRow.deckBrief as DeckBrief,
      currentRevision: revisionRow
        ? {
            revision: revisionRow.revision,
            slideDeck: revisionRow.slideDeck,
            designPlan: revisionRow.designPlan ?? null,
            html: revisionRow.html,
            generationSummary: revisionRow.generationSummary ?? null,
            origin: revisionRow.origin as DeckOrigin,
            sourceJobId: revisionRow.sourceJobId,
            createdAt: revisionRow.createdAt.toISOString()
          }
        : null
    };
  }
}
