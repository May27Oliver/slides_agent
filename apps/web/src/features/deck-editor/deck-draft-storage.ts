import type { ChartOperation, SlideDeck } from "@slides-agent/domain";

/**
 * 010 (US3, data-model §7): a localStorage autosave draft. Never touches the DB and
 * never creates a revision — it's a crash/refresh safety net. Keyed by deckId and
 * tagged with the base revision + savedAt so re-entry can classify it.
 */
export interface DeckDraft {
  deckId: string;
  baseRevision: number;
  slideDeck: SlideDeck;
  savedAt: string;
  /** 014: pending chart operations, restored together with the text edits. */
  chartOperations?: ChartOperation[];
}

/** Autosave cadence (FR-013). Injectable in the component for tests. */
export const AUTOSAVE_INTERVAL_MS = 3 * 60 * 1000;

export type DraftClassification = "restorable" | "conflict" | "none";

const keyFor = (deckId: string): string => `deck-draft:${deckId}`;

/** localStorage if usable, else null — every caller degrades silently (FR-013). */
function safeStorage(): Storage | null {
  try {
    return (globalThis as { localStorage?: Storage }).localStorage ?? null;
  } catch {
    return null;
  }
}

export function saveDraft(draft: DeckDraft, storage: Storage | null = safeStorage()): void {
  if (!storage) return;
  try {
    storage.setItem(keyFor(draft.deckId), JSON.stringify(draft));
  } catch {
    // Quota exceeded / disabled — autosave is best-effort, never blocks editing.
  }
}

export function loadDraft(
  deckId: string,
  storage: Storage | null = safeStorage()
): DeckDraft | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(keyFor(deckId));
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return isValidDraftShape(parsed, deckId) ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * Structural guard for a parsed draft (defense-in-depth: localStorage is attacker-
 * influenceable via XSS/extensions). The server merge is the authoritative gate, but
 * we refuse to feed obviously malformed shapes into the editor's React state.
 */
function isValidDraftShape(value: unknown, deckId: string): value is DeckDraft {
  if (typeof value !== "object" || value === null) return false;
  const d = value as Record<string, unknown>;
  if (d.deckId !== deckId) return false;
  if (typeof d.baseRevision !== "number") return false;
  if (typeof d.savedAt !== "string") return false;
  if (d.chartOperations !== undefined && !Array.isArray(d.chartOperations)) return false;
  const deck = d.slideDeck;
  if (typeof deck !== "object" || deck === null) return false;
  const slides = (deck as Record<string, unknown>).slides;
  return (
    Array.isArray(slides) &&
    slides.every(
      (s) =>
        typeof s === "object" && s !== null && typeof (s as Record<string, unknown>).id === "string"
    )
  );
}

export function clearDraft(deckId: string, storage: Storage | null = safeStorage()): void {
  if (!storage) return;
  try {
    storage.removeItem(keyFor(deckId));
  } catch {
    // ignore
  }
}

/**
 * Classify a draft against the deck's current DB revision (FR-014):
 * - `restorable`: same base AND newer than the current revision → offer restore.
 * - `conflict`: a different base → the DB advanced elsewhere; show latest, not silent.
 * - `none`: no draft, or stale/older than current → nothing to offer.
 */
export function classifyDraft(
  draft: DeckDraft | null,
  current: { revision: number; createdAt: string }
): DraftClassification {
  if (!draft) return "none";
  if (draft.baseRevision !== current.revision) return "conflict";
  // ISO 8601 strings compare lexicographically in chronological order.
  return draft.savedAt > current.createdAt ? "restorable" : "none";
}
