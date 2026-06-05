import type { DeckBrief } from "@/deck/deck.types";
import type { Deck, DeckRevision } from "@/deck-persistence/deck.types";

/** Row shape for the "my decks" list (no heavy html/jsonb columns). */
export interface DeckSummary {
  id: string;
  title: string;
  status: string;
  updatedAt: string;
}

/** A single deck with its current revision, for detail views. */
export interface DeckDetail {
  id: string;
  title: string;
  status: string;
  sourceContent: string;
  deckBrief: DeckBrief;
  currentRevision: (DeckRevision & { createdAt: string }) | null;
}

/**
 * Capability boundary for persisted decks. Reads are always scoped to an account
 * (ownership isolation). Implemented by a DB adapter in the API layer; domain
 * stays free of SQL.
 */
export interface DeckStore {
  /** Persist a new deck + its first revision; returns the new deck id. */
  saveNewDeck(deck: Deck): Promise<{ deckId: string }>;
  /** List the account's decks, newest first. */
  listByAccount(accountId: string): Promise<DeckSummary[]>;
  /** Fetch one deck the account owns, or null (never another account's). */
  findByIdForAccount(accountId: string, deckId: string): Promise<DeckDetail | null>;
}
