import type { DeckRevisionContract } from "@slides-agent/contracts";
import { applyDeckEdit } from "@slides-agent/domain";
import type {
  ApplyDeckEditOptions,
  DeckRevision,
  GenerationSummary,
  SlideDeck
} from "@slides-agent/domain";

export type LivePreviewResult =
  // 014: the summary rides along so the editor UI (chart cards: rendered visual,
  // degradation notes, user-data disclosures) reads the SAME evidence the server
  // would store — no second rendering channel.
  { ok: true; html: string; generationSummary: GenerationSummary } | { ok: false; reason: string };

/**
 * 010 (US1, FR-005a): render the working deck locally with the EXACT same domain
 * use-case the server runs on save (`applyDeckEdit`), seeded with the base
 * revision's designPlan + chartIntents + theme. Same code + same inputs ⇒ byte-for-
 * byte parity with the server's stored html, with zero network round-trips. A
 * rejected edit (read-only tampering / unrenderable) returns a soft reason so the
 * preview can degrade locally instead of crashing — the server stays authoritative.
 *
 * 011: when the user re-themes, the same `themeSelection` + catalogue `candidates`
 * flow through the SAME resolver, so the local preview matches the server's stored
 * re-themed html (parity preserved through the theme path too).
 */
export function renderLivePreview(
  base: DeckRevisionContract,
  workingDeck: SlideDeck,
  options: ApplyDeckEditOptions = {}
): LivePreviewResult {
  try {
    // DeckRevisionContract is a structural superset of the domain DeckRevision
    // (it adds createdAt); the renderer reads only the persisted fields.
    const result = applyDeckEdit(base as unknown as DeckRevision, workingDeck, options);
    if (!result.ok) {
      return { ok: false, reason: result.detail };
    }
    return {
      ok: true,
      html: result.payload.html,
      generationSummary: result.payload.generationSummary
    };
  } catch (error) {
    return { ok: false, reason: error instanceof Error ? error.message : "render failed" };
  }
}
