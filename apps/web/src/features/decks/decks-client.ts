import type { DeckDetailResponseContract, DeckListResponseContract } from "@slides-agent/contracts";

/** Thrown for any non-401 deck read failure (401 is handled by authFetch itself). */
export class DeckRequestError extends Error {
  constructor(message = "Deck request failed") {
    super(message);
    this.name = "DeckRequestError";
  }
}

/**
 * List the current user's decks. `fetchImpl` is the auth-aware fetch from
 * AuthProvider, which attaches the bearer token and turns a 401 into an AuthError
 * (redirecting to /login) before we ever see it here. Like the other web
 * clients, the typed response is trusted (the API is the contract source of truth).
 */
export async function listDecks(
  fetchImpl: typeof fetch = fetch
): Promise<DeckListResponseContract> {
  const response = await fetchImpl("/api/decks");
  if (!response.ok) {
    throw new DeckRequestError(`Failed to load decks (${response.status})`);
  }
  return (await response.json()) as DeckListResponseContract;
}

/** Fetch one deck the current user owns. A 404 surfaces as a DeckRequestError. */
export async function getDeck(
  id: string,
  fetchImpl: typeof fetch = fetch
): Promise<DeckDetailResponseContract> {
  const response = await fetchImpl(`/api/decks/${encodeURIComponent(id)}`);
  if (!response.ok) {
    throw new DeckRequestError(`Failed to load deck (${response.status})`);
  }
  return (await response.json()) as DeckDetailResponseContract;
}
