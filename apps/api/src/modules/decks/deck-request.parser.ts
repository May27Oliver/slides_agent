import { BadRequestException } from "@nestjs/common";

// Canonical UUID (any version): 8-4-4-4-12 hex. Deck ids come from
// gen_random_uuid(), so anything that isn't a UUID can never match a row —
// reject it up front with a 400 rather than running a guaranteed-miss query.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;

/**
 * Bounds the `:id` path param before it reaches the store lookup. Mirrors the
 * preview-jobs `assertValidJobId` convention: a malformed id is a 400, while a
 * well-formed-but-unknown id flows through to the normal not-found path.
 */
export function assertValidDeckId(deckId: string): string {
  if (typeof deckId !== "string" || !UUID.test(deckId)) {
    throw new BadRequestException({
      code: "INVALID_DECK_ID",
      message: "Invalid deck id."
    });
  }
  return deckId;
}
