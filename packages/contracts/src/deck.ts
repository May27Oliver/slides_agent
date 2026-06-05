/**
 * Read-only "my decks" API contracts (feature 006 US3). Shapes mirror the API
 * responses for `GET /api/decks` and `GET /api/decks/:id`. The structured
 * `slideDeck` / `designPlan` / `generationSummary` payloads stay `unknown` here so
 * the web layer never re-declares domain types it only forwards to the renderer.
 */

export interface DeckSummaryContract {
  id: string;
  title: string;
  status: string;
  updatedAt: string;
}

export interface DeckListResponseContract {
  decks: DeckSummaryContract[];
}

export interface DeckRevisionContract {
  revision: number;
  slideDeck: unknown;
  designPlan: unknown | null;
  html: string | null;
  generationSummary: unknown | null;
  origin: "generation" | "edit";
  sourceJobId: string | null;
  createdAt: string;
}

export interface DeckDetailResponseContract {
  id: string;
  title: string;
  status: string;
  sourceContent: string;
  deckBrief: unknown;
  // Null only for the (unexpected) case of a deck with no current revision; the
  // generation flow always writes one, but the read path stays defensive.
  currentRevision: DeckRevisionContract | null;
}

/** Unified not-found shape; never reveals whether the id exists for another account. */
export interface DeckNotFoundContract {
  code: "DECK_NOT_FOUND";
  message: string;
}

export type DeckContractValidationResult<T> =
  | { ok: true; value: T }
  | { ok: false; issues: string[] };

const ORIGINS = new Set(["generation", "edit"]);

export function validateDeckListResponse(
  input: unknown
): DeckContractValidationResult<DeckListResponseContract> {
  if (!isRecord(input) || !Array.isArray(input.decks)) {
    return invalid(["response must have a decks array"]);
  }

  const issues: string[] = [];
  input.decks.forEach((deck, index) => {
    if (!isValidSummary(deck)) {
      issues.push(`decks[${index}] is invalid`);
    }
  });

  return issues.length === 0
    ? { ok: true, value: input as unknown as DeckListResponseContract }
    : invalid(issues);
}

export function validateDeckDetailResponse(
  input: unknown
): DeckContractValidationResult<DeckDetailResponseContract> {
  if (!isRecord(input)) {
    return invalid(["response must be an object"]);
  }

  const issues: string[] = [];
  requireString(input, "id", issues);
  requireString(input, "title", issues);
  requireString(input, "status", issues);
  requireString(input, "sourceContent", issues);

  if (!isRecord(input.deckBrief)) {
    issues.push("deckBrief must be an object");
  }

  if (input.currentRevision !== null && !isValidRevision(input.currentRevision)) {
    issues.push("currentRevision is invalid");
  }

  return issues.length === 0
    ? { ok: true, value: input as unknown as DeckDetailResponseContract }
    : invalid(issues);
}

function isValidSummary(value: unknown): value is DeckSummaryContract {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.title === "string" &&
    typeof value.status === "string" &&
    typeof value.updatedAt === "string"
  );
}

function isValidRevision(value: unknown): value is DeckRevisionContract {
  return (
    isRecord(value) &&
    typeof value.revision === "number" &&
    "slideDeck" in value &&
    (value.html === null || typeof value.html === "string") &&
    isStringInSet(value.origin, ORIGINS) &&
    (value.sourceJobId === null || typeof value.sourceJobId === "string") &&
    typeof value.createdAt === "string"
  );
}

function requireString(input: Record<string, unknown>, key: string, issues: string[]): void {
  if (typeof input[key] !== "string") {
    issues.push(`${key} must be a string`);
  }
}

function isStringInSet(value: unknown, allowed: Set<string>): value is string {
  return typeof value === "string" && allowed.has(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function invalid<T>(issues: string[]): DeckContractValidationResult<T> {
  return { ok: false, issues };
}
