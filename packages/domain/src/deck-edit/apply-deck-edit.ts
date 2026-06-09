import type { ChartIntent } from "@/content-core/chart-intent.types";
import type { GenerationSummary, SlideDeck } from "@/deck/deck.types";
import type { DeckRevision } from "@/deck-persistence/deck.types";
import type { DesignPlanningResult } from "@/design/types";
import { renderTemplateDeckArtifact } from "@/rendering/html-deck-renderer";
import { mergeEditedDeck } from "@/deck-edit/slide-merge";
import type { ApplyDeckEditResult } from "@/deck-edit/apply-deck-edit.types";

/** Honest disclosure when a legacy base has no persisted chart inputs to redraw. */
const LEGACY_CHART_NOTE =
  "圖表未重現：此版本無持久化的圖表輸入（chartIntents），確定性重渲染無法畫回原圖。";

/**
 * 010 (US1, data-model §5): pure domain use-case. Merge the client's edit onto the
 * base revision (whitelist + read-only enforcement + outline fidelity), then
 * deterministically re-render — NO LLM, NO DB. Reuses the base `designPlan`,
 * `chartIntents` and theme evidence so the deck looks identical except for the
 * edited text. Returns a ready-to-persist `origin="edit"` payload, or a rejection
 * (tampering → INVALID_EDIT; unrenderable deck → VALIDATION_FAILED).
 */
export function applyDeckEdit(base: DeckRevision, edited: SlideDeck): ApplyDeckEditResult {
  const merge = mergeEditedDeck(base.slideDeck as SlideDeck, edited);
  if (!merge.ok) {
    return { ok: false, rejection: "INVALID_EDIT", detail: merge.detail };
  }

  const emptiness = findUnrenderableReason(merge.slideDeck);
  if (emptiness) {
    return { ok: false, rejection: "VALIDATION_FAILED", detail: emptiness };
  }

  const baseSummary = base.generationSummary as GenerationSummary | null;
  if (!baseSummary?.selectedTheme) {
    // Theme evidence is required to rebuild the summary. Every 007+ generation
    // revision carries it; a missing one is an un-editable pre-theme legacy revision.
    return {
      ok: false,
      rejection: "VALIDATION_FAILED",
      detail: "base revision is missing theme evidence; regenerate before editing"
    };
  }

  const baseDesignPlan = base.designPlan as DesignPlanningResult;
  const survivingIds = new Set(merge.slideDeck.slides.map((slide) => slide.id));
  // Prune pattern assignments for slides the edit removed, so HTML validation (which
  // checks every assignment is present) does not fail on a legitimate slide deletion.
  const designPlan: DesignPlanningResult = {
    ...baseDesignPlan,
    slidePatternAssignments: baseDesignPlan.slidePatternAssignments.filter((assignment) =>
      survivingIds.has(assignment.slideId)
    )
  };

  const chartIntents = (base.chartIntents as ChartIntent[] | null) ?? null;
  const deckToRender = withLegacyChartDisclosure(merge.slideDeck, chartIntents);

  const artifact = renderTemplateDeckArtifact({
    deck: deckToRender,
    designPlanningResult: designPlan,
    ...(chartIntents ? { chartIntents } : {}),
    selectedTheme: baseSummary.selectedTheme
  });

  // Only a genuine `failed` blocks the save — `repair_required` is accepted, exactly
  // as the generation pipeline does (slides.service does not block on it). Blocking on
  // `!== "pass"` would be stricter than generation and could permanently lock editing
  // on a deck whose deterministic re-render trips a soft sub-check (e.g. a bullet
  // dropped by the chart-split filter). Empty/unrenderable decks are already caught
  // by findUnrenderableReason above (FR-008).
  if (artifact.htmlGenerationValidation.status === "failed") {
    return {
      ok: false,
      rejection: "VALIDATION_FAILED",
      detail: "html generation failed"
    };
  }

  return {
    ok: true,
    payload: {
      slideDeck: deckToRender,
      designPlan,
      chartIntents,
      html: artifact.html,
      generationSummary: artifact.generationSummary,
      origin: "edit",
      sourceJobId: null
    }
  };
}

/**
 * When the base carries no chart inputs but the merged deck still has chart blocks,
 * the deterministic re-render cannot redraw the charts. We surface an honest review
 * note rather than silently dropping them or claiming they were drawn (FR-006a).
 */
function withLegacyChartDisclosure(deck: SlideDeck, chartIntents: ChartIntent[] | null): SlideDeck {
  if (chartIntents) {
    return deck;
  }
  const hasChartBlocks = deck.slides.some((slide) =>
    slide.contentBlocks.some((block) => block.kind === "chart_placeholder")
  );
  if (!hasChartBlocks) {
    return deck;
  }
  // reviewReport is required by the type but sourced from opaque JSONB; guard against
  // a legacy/malformed row missing it rather than crashing the whole use-case.
  const baseReport: SlideDeck["reviewReport"] = deck.reviewReport ?? {
    assumptions: [],
    omittedOrCompressedContent: [],
    uncertainClaims: [],
    chartingDecisions: [],
    humanReviewNotes: []
  };
  return {
    ...deck,
    reviewReport: {
      ...baseReport,
      humanReviewNotes: [...(baseReport.humanReviewNotes ?? []), LEGACY_CHART_NOTE]
    }
  };
}

/** Returns a reason when the deck cannot be a valid slideshow, else null (FR-008). */
function findUnrenderableReason(deck: SlideDeck): string | null {
  if (deck.slides.length === 0) {
    return "deck has no slides";
  }
  const emptySlide = deck.slides.find(
    (slide) =>
      slide.title.trim().length === 0 &&
      slide.message.trim().length === 0 &&
      slide.outline.every((item) => item.text.trim().length === 0)
  );
  if (emptySlide) {
    return `slide "${emptySlide.id}" has no title, message, or outline text`;
  }
  return null;
}
