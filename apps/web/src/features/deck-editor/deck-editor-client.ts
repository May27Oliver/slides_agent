import type {
  DeckRevisionContract,
  EditRevisionRequestContract
} from "@slides-agent/contracts";

/** 409: the deck was edited elsewhere; carries the latest revision to rebase onto. */
export class EditConflictError extends Error {
  constructor(readonly currentRevision: number) {
    super("This deck was updated elsewhere.");
    this.name = "EditConflictError";
  }
}

/** 400: the edit was rejected (read-only tampering / unrenderable deck / bad body). */
export class EditInvalidError extends Error {
  constructor(readonly fields: string[] = []) {
    super("Edit could not be applied.");
    this.name = "EditInvalidError";
  }
}

/** 404: the deck does not exist or is owned by another account. */
export class EditNotFoundError extends Error {
  constructor() {
    super("Deck not found.");
    this.name = "EditNotFoundError";
  }
}

/** Any other non-success response. */
export class EditRequestError extends Error {
  constructor(status: number) {
    super(`Edit request failed (${status})`);
    this.name = "EditRequestError";
  }
}

/**
 * 010 (US1, FR-007): POST an edit and create a new revision. Mirrors the other web
 * clients' fetch/auth convention (the auth-aware `fetchImpl` handles 401). Maps each
 * documented status to a typed error so the view can react (409 → reload latest,
 * 400 → surface fields).
 */
export async function createEditRevision(
  deckId: string,
  body: EditRevisionRequestContract,
  fetchImpl: typeof fetch = fetch
): Promise<DeckRevisionContract> {
  const response = await fetchImpl(`/api/decks/${encodeURIComponent(deckId)}/revisions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });

  if (response.ok) {
    return (await response.json()) as DeckRevisionContract;
  }

  const payload = (await response.json().catch(() => null)) as
    | { code?: string; currentRevision?: number; fields?: string[] }
    | null;

  if (response.status === 409) {
    throw new EditConflictError(payload?.currentRevision ?? 0);
  }
  if (response.status === 400) {
    throw new EditInvalidError(payload?.fields ?? []);
  }
  if (response.status === 404) {
    throw new EditNotFoundError();
  }
  throw new EditRequestError(response.status);
}
