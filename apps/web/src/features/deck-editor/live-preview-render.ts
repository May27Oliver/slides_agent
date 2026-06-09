import type { DeckRevisionContract } from "@slides-agent/contracts";
import { applyDeckEdit } from "@slides-agent/domain";
import type { DeckRevision, SlideDeck } from "@slides-agent/domain";

export type LivePreviewResult =
  | { ok: true; html: string }
  | { ok: false; reason: string };

/**
 * 010 (US1, FR-005a): render the working deck locally with the EXACT same domain
 * use-case the server runs on save (`applyDeckEdit`), seeded with the base
 * revision's designPlan + chartIntents + theme. Same code + same inputs ⇒ byte-for-
 * byte parity with the server's stored html, with zero network round-trips. A
 * rejected edit (read-only tampering / unrenderable) returns a soft reason so the
 * preview can degrade locally instead of crashing — the server stays authoritative.
 */
export function renderLivePreview(
  base: DeckRevisionContract,
  workingDeck: SlideDeck
): LivePreviewResult {
  try {
    // DeckRevisionContract is a structural superset of the domain DeckRevision
    // (it adds createdAt); the renderer reads only the persisted fields.
    const result = applyDeckEdit(base as unknown as DeckRevision, workingDeck);
    if (!result.ok) {
      return { ok: false, reason: result.detail };
    }
    return { ok: true, html: result.payload.html };
  } catch (error) {
    return { ok: false, reason: error instanceof Error ? error.message : "render failed" };
  }
}
