import type { DeckSummaryContract } from "@slides-agent/contracts";

/**
 * 010 (US2, FR-009): how many recent decks the switcher dropdown shows. Single
 * source of truth — adjustable in one place, never hardcoded per call site.
 */
export const RECENT_DECKS_LIMIT = 8;

function sortByUpdatedDesc(decks: readonly DeckSummaryContract[]): DeckSummaryContract[] {
  // ISO 8601 strings sort lexicographically in chronological order.
  return [...decks].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

/** The newest N decks, for the dropdown's default (no-search) view. */
export function recentDecks(
  decks: readonly DeckSummaryContract[],
  limit: number = RECENT_DECKS_LIMIT
): DeckSummaryContract[] {
  return sortByUpdatedDesc(decks).slice(0, Math.max(0, limit));
}

/** Case-insensitive title filter over the FULL list (≤200), newest first. */
export function filterDecksByTitle(
  decks: readonly DeckSummaryContract[],
  query: string
): DeckSummaryContract[] {
  const q = query.trim().toLowerCase();
  if (!q) {
    return sortByUpdatedDesc(decks);
  }
  return sortByUpdatedDesc(decks.filter((deck) => deck.title.toLowerCase().includes(q)));
}

/**
 * What the switcher shows: an empty query yields the recent N; a non-empty query
 * filters the whole set by title (so matches beyond the recent N are still findable).
 */
export function switcherDecks(
  decks: readonly DeckSummaryContract[],
  query: string,
  limit: number = RECENT_DECKS_LIMIT
): DeckSummaryContract[] {
  return query.trim() ? filterDecksByTitle(decks, query) : recentDecks(decks, limit);
}
