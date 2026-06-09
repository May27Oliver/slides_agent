import { Inject, Injectable } from "@nestjs/common";
import { and, desc, eq } from "drizzle-orm";
import type {
  AppendEditResult,
  Deck,
  DeckBrief,
  DeckDetail,
  DeckOrigin,
  DeckStore,
  DeckSummary,
  EditRevisionInput
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
          chartIntents: deck.revision.chartIntents,
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
            chartIntents: revisionRow.chartIntents ?? null,
            origin: revisionRow.origin as DeckOrigin,
            sourceJobId: revisionRow.sourceJobId,
            createdAt: revisionRow.createdAt.toISOString()
          }
        : null
    };
  }

  async appendEditRevision(
    accountId: string,
    deckId: string,
    expectedBaseRevision: number,
    payload: EditRevisionInput
  ): Promise<AppendEditResult> {
    // One transaction: lock the deck row, re-read the current revision, compare
    // against the base the client edited from, then (only on match) insert the new
    // revision and re-point current_revision_id. The `FOR UPDATE` lock serializes
    // concurrent edits on the same deck: a second edit blocks until the first commits,
    // then (under READ COMMITTED) the lock grant re-reads the latest committed
    // `current_revision_id`, so its optimistic check sees the new revision and returns
    // a conflict — no TOCTOU gap. The unique index on (deck_id, revision) is the final
    // backstop, converted to a conflict (not a 500) by the catch below.
    try {
      return await this.appendEditRevisionTx(accountId, deckId, expectedBaseRevision, payload);
    } catch (error) {
      if (isUniqueViolation(error)) {
        return {
          ok: false,
          conflict: true,
          currentRevision: await this.readRevision(accountId, deckId)
        };
      }
      throw error;
    }
  }

  private appendEditRevisionTx(
    accountId: string,
    deckId: string,
    expectedBaseRevision: number,
    payload: EditRevisionInput
  ): Promise<AppendEditResult> {
    return this.db.transaction(async (tx) => {
      const [deckRow] = await tx
        .select({ id: decks.id, currentRevisionId: decks.currentRevisionId })
        .from(decks)
        .where(and(eq(decks.id, deckId), eq(decks.accountId, accountId)))
        .for("update")
        .limit(1);

      // The caller (controller) verifies existence/ownership via findByIdForAccount
      // and returns 404 before reaching here; a row missing now is a rare concurrent
      // delete — surface it rather than writing an orphan revision.
      if (!deckRow) {
        throw new Error(`deck ${deckId} not found for edit append`);
      }

      let currentRevision = 0;
      if (deckRow.currentRevisionId) {
        const [currentRow] = await tx
          .select({ revision: deckRevisions.revision })
          .from(deckRevisions)
          .where(eq(deckRevisions.id, deckRow.currentRevisionId))
          .limit(1);
        currentRevision = currentRow?.revision ?? 0;
      }

      if (currentRevision !== expectedBaseRevision) {
        return { ok: false, conflict: true, currentRevision };
      }

      const nextRevision = currentRevision + 1;
      const [revisionRow] = await tx
        .insert(deckRevisions)
        .values({
          deckId,
          revision: nextRevision,
          slideDeck: payload.slideDeck,
          designPlan: payload.designPlan,
          html: payload.html,
          generationSummary: payload.generationSummary,
          chartIntents: payload.chartIntents,
          origin: payload.origin,
          sourceJobId: payload.sourceJobId
        })
        .returning({ id: deckRevisions.id, createdAt: deckRevisions.createdAt });
      if (!revisionRow) {
        throw new Error("Failed to insert edit revision row");
      }

      await tx
        .update(decks)
        .set({ currentRevisionId: revisionRow.id, updatedAt: new Date() })
        .where(eq(decks.id, deckId));

      return {
        ok: true,
        revision: {
          revision: nextRevision,
          slideDeck: payload.slideDeck,
          designPlan: payload.designPlan ?? null,
          html: payload.html,
          generationSummary: payload.generationSummary ?? null,
          chartIntents: payload.chartIntents ?? null,
          origin: payload.origin,
          sourceJobId: payload.sourceJobId,
          createdAt: revisionRow.createdAt.toISOString()
        }
      };
    });
  }

  /** Current revision number for a deck the account owns; 0 if none. */
  private async readRevision(accountId: string, deckId: string): Promise<number> {
    const [row] = await this.db
      .select({ revision: deckRevisions.revision })
      .from(decks)
      .innerJoin(
        deckRevisions,
        and(eq(deckRevisions.id, decks.currentRevisionId), eq(deckRevisions.deckId, decks.id))
      )
      .where(and(eq(decks.id, deckId), eq(decks.accountId, accountId)))
      .limit(1);
    return row?.revision ?? 0;
  }
}

/** Postgres unique-violation (SQLSTATE 23505) — used as the revision-collision backstop. */
function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "23505"
  );
}
