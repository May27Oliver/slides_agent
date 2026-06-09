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
  /**
   * 010 (C1/FR-006a): planned chart intents (source facts) the deterministic
   * renderer needs to redraw real charts on edit. Opaque (`unknown`) at this
   * boundary like the other jsonb payloads. Null for legacy (pre-010) revisions
   * and for decks with no charts written before this column existed → the editor
   * re-render degrades to the renderer's chart fallback rather than fabricating.
   */
  chartIntents: unknown | null;
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

/**
 * 010 (US1, data-model §6): the opaque, already-rendered payload the store appends
 * as a new `origin="edit"` revision. Structurally a superset-compatible view of the
 * domain `EditRevisionPayload` (its typed fields widen to `unknown` here), so the
 * store stays free of domain types and the use-case stays free of SQL.
 */
export interface EditRevisionInput {
  slideDeck: unknown;
  designPlan: unknown | null;
  chartIntents: unknown | null;
  html: string | null;
  generationSummary: unknown | null;
  origin: "edit";
  sourceJobId: null;
}

/**
 * Outcome of an optimistic-concurrency append. `conflict` means the base the client
 * edited from is no longer current (FR-020) — nothing was written; the caller maps
 * it to a 409 carrying `currentRevision`.
 */
export type AppendEditResult =
  | { ok: true; revision: DeckRevision & { createdAt: string } }
  | { ok: false; conflict: true; currentRevision: number };
