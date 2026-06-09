import type { ChartIntent } from "@/content-core/chart-intent.types";
import type { GenerationSummary, SlideDeck } from "@/deck/deck.types";
import type { DesignPlanningResult } from "@/design/types";

/**
 * 010 (US1, data-model §5): the fully-rendered payload `applyDeckEdit` produces and
 * hands to the store to append as a new `origin="edit"` revision. The use-case does
 * the merge + deterministic re-render (no LLM, no DB); the store only persists.
 */
export interface EditRevisionPayload {
  /** Merged deck: base read-only blocks/structure + the client's whitelisted text. */
  slideDeck: SlideDeck;
  /** Reused verbatim from the base revision (the edit never re-plans design). */
  designPlan: DesignPlanningResult;
  /** Reused from base so charts redraw identically; null for legacy/chart-less bases. */
  chartIntents: ChartIntent[] | null;
  /** Deterministic re-render of the merged deck. */
  html: string;
  generationSummary: GenerationSummary;
  origin: "edit";
  /** Edits are not tied to a generation job. */
  sourceJobId: null;
}

/**
 * Result of `applyDeckEdit`. `INVALID_EDIT` = merge rejected client tampering
 * (read-only block / non-editable field / structure injection, FR-021).
 * `VALIDATION_FAILED` = merged deck failed HTML generation validation (empty deck /
 * missing required fields, FR-008). Both map to a 400 at the controller; neither
 * writes a revision.
 */
export type ApplyDeckEditResult =
  | { ok: true; payload: EditRevisionPayload }
  | { ok: false; rejection: "INVALID_EDIT" | "VALIDATION_FAILED"; detail: string };
