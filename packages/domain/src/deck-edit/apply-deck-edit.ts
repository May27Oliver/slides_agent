import type { ChartIntent } from "@/content-core/chart-intent.types";
import type { GenerationSummary, SlideDeck } from "@/deck/deck.types";
import type { DeckRevision } from "@/deck-persistence/deck.types";
import { applyThemeSelection } from "@/design/apply-theme-selection";
import { projectSelectedThemeSummary } from "@/design/selected-theme-summary";
import type { ManualThemeSelection, ThemeSelectionWarning } from "@/design/theme-selection.types";
import type { SelectableTheme } from "@/design/theme.types";
import type { DesignPlanningResult } from "@/design/types";
import { renderTemplateDeckArtifact } from "@/rendering/html-deck-renderer";
import { mergeEditedDeck } from "@/deck-edit/slide-merge";
import type { ApplyDeckEditResult } from "@/deck-edit/apply-deck-edit.types";

/**
 * 011: optional deterministic re-theme during an edit. When `themeSelection` is
 * given, the styleKit is recomposed from the SAME `applyThemeSelection` resolver the
 * generation path uses (baseline = the base revision's three axis ids), `candidates`
 * being the current browse catalogue. Absent ⇒ 010 behaviour (reuse base theme).
 */
export interface ApplyDeckEditOptions {
  themeSelection?: ManualThemeSelection;
  candidates?: SelectableTheme[];
}

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
export function applyDeckEdit(
  base: DeckRevision,
  edited: SlideDeck,
  options: ApplyDeckEditOptions = {}
): ApplyDeckEditResult {
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

  // 011: optionally re-theme. With no (or an EMPTY) themeSelection this is exactly 010
  // — reuse the base theme verbatim, no warnings. An empty `{}` must NOT take the
  // re-theme path: the client live preview always passes the current selection object
  // (often `{}`), and the server save only sends a selection when an axis is set
  // (hasThemeSelection guard). Treating `{}` as a re-theme would recompose from the
  // catalogue (or fall to default while it loads / for legacy ids), diverging the
  // preview from what save stores. So gate on an actual axis override.
  let selectedThemeSummary = baseSummary.selectedTheme;
  let themeSelectionWarnings: ThemeSelectionWarning[] = [];
  let restyledKit: DesignPlanningResult["styleKit"] | undefined;
  if (hasAxisOverride(options.themeSelection)) {
    // A legacy base summary may lack the three axis ids; treat each missing axis as
    // unresolvable (→ default kit + base_unresolved warning), never crash (§7).
    const baselineIds = baseSummary.selectedTheme.ids ?? {
      style: null,
      palette: null,
      font: null
    };
    const { selectedTheme, warnings } = applyThemeSelection(
      baselineIds,
      options.themeSelection,
      options.candidates ?? []
    );
    selectedThemeSummary = projectSelectedThemeSummary(
      selectedTheme,
      baseDesignPlan.designSystem.visualDensity
    );
    themeSelectionWarnings = warnings;
    restyledKit = selectedTheme.styleKit;
  }

  // Prune pattern assignments for slides the edit removed, so HTML validation (which
  // checks every assignment is present) does not fail on a legitimate slide deletion.
  const designPlan: DesignPlanningResult = {
    ...baseDesignPlan,
    slidePatternAssignments: baseDesignPlan.slidePatternAssignments.filter((assignment) =>
      survivingIds.has(assignment.slideId)
    ),
    ...(restyledKit ? { styleKit: restyledKit } : {})
  };

  const chartIntents = (base.chartIntents as ChartIntent[] | null) ?? null;
  const deckToRender = withLegacyChartDisclosure(merge.slideDeck, chartIntents);

  const artifact = renderTemplateDeckArtifact({
    deck: deckToRender,
    designPlanningResult: designPlan,
    ...(chartIntents ? { chartIntents } : {}),
    selectedTheme: selectedThemeSummary,
    themeSelectionWarnings
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

/** True only when at least one axis is actually overridden (an empty `{}` is a no-op). */
function hasAxisOverride(selection: ManualThemeSelection | undefined): boolean {
  return Boolean(selection && (selection.fontId || selection.paletteId || selection.styleId));
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
