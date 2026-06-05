import type { DeckBrief } from "@/deck/deck.types";

/** How a revision came to exist. 006 only produces `generation`; `edit` is for later. */
export type DeckOrigin = "generation" | "edit";

/**
 * One full snapshot of a deck. The structured `slideDeck` is the source of truth;
 * `html` is a derived cache (re-computable by the renderer). Stored as jsonb, so
 * the opaque payloads are typed `unknown` at this boundary.
 */
export interface DeckRevision {
  revision: number;
  slideDeck: unknown;
  designPlan: unknown | null;
  html: string | null;
  generationSummary: unknown | null;
  origin: DeckOrigin;
  sourceJobId: string | null;
}

/** A deck owned by an account, plus the revision created with it. */
export interface Deck {
  accountId: string;
  title: string;
  status: "ready" | "failed";
  sourceContent: string;
  deckBrief: DeckBrief;
  revision: DeckRevision;
}
