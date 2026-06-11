import type { ChartIntent } from "@/content-core/chart-intent.types";
import type { GenerationSummary, SlideDeck, UserDataDisclosure } from "@/deck/deck.types";
import type { DeckRevision } from "@/deck-persistence/deck.types";
import { applyThemeSelection } from "@/design/apply-theme-selection";
import { projectSelectedThemeSummary } from "@/design/selected-theme-summary";
import type { ManualThemeSelection, ThemeSelectionWarning } from "@/design/theme-selection.types";
import type { SelectableTheme } from "@/design/theme.types";
import type { DesignPlanningResult } from "@/design/types";
import { renderTemplateDeckArtifact } from "@/rendering/html-deck-renderer";
import { mergeEditedDeck } from "@/deck-edit/slide-merge";
import { applyChartOperations } from "@/deck-edit/apply-chart-operations";
import type { ChartOperation } from "@/deck-edit/chart-operation.types";
import type { ApplyDeckEditResult } from "@/deck-edit/apply-deck-edit.types";

/**
 * 011: optional deterministic re-theme during an edit. When `themeSelection` is
 * given, the styleKit is recomposed from the SAME `applyThemeSelection` resolver the
 * generation path uses (baseline = the base revision's three axis ids), `candidates`
 * being the current browse catalogue. Absent ⇒ 010 behaviour (reuse base theme).
 *
 * 014: optional structured chart operations (the ONLY legal chart-edit channel —
 * contentBlocks stay read-only). Absent or `[]` ⇒ 010/011 behaviour, the base
 * `chartIntents`/`designPlan` are reused verbatim.
 */
export interface ApplyDeckEditOptions {
  themeSelection?: ManualThemeSelection;
  candidates?: SelectableTheme[];
  chartOperations?: ChartOperation[];
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

  // 014: structured chart operations apply on TOP of the merged deck (merge keeps
  // contentBlocks read-only; operations are the only legal chart-edit channel).
  // With no operations this is a passthrough and the base values are reused verbatim.
  const baseDesignPlan = base.designPlan as DesignPlanningResult;
  const baseChartIntents = (base.chartIntents as ChartIntent[] | null) ?? null;
  const operations = options.chartOperations ?? [];
  let workingDeck = merge.slideDeck;
  let chartIntents = baseChartIntents;
  let chartTreatmentPlans = baseDesignPlan.chartTreatmentPlans;
  if (operations.length > 0) {
    const opsResult = applyChartOperations({
      mergedDeck: merge.slideDeck,
      baseChartIntents,
      baseTreatmentPlans: baseDesignPlan.chartTreatmentPlans,
      baseRevision: base.revision,
      operations
    });
    if (!opsResult.ok) {
      return opsResult;
    }
    workingDeck = opsResult.slideDeck;
    chartIntents = opsResult.chartIntents;
    chartTreatmentPlans = opsResult.treatmentPlans;
  }

  const emptiness = findUnrenderableReason(workingDeck);
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

  const survivingIds = new Set(workingDeck.slides.map((slide) => slide.id));

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
    // 014: derived treatment plans (=== base plans when no operations ran).
    chartTreatmentPlans,
    ...(restyledKit ? { styleKit: restyledKit } : {})
  };

  // 014: structured disclosure of user-provided data points (always computed from
  // the FINAL intents × placements, so it persists across follow-up edits) plus the
  // synced review-report lines/decisions (zero delta when no user data is involved).
  const userDataDisclosures = collectUserDataDisclosures(workingDeck, chartIntents);
  const deckWithReview = syncUserDataReview(
    workingDeck,
    userDataDisclosures,
    mintUserDataDecisions(operations, base.revision, chartIntents)
  );
  const deckToRender = withLegacyChartDisclosure(deckWithReview, chartIntents);

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
      generationSummary: { ...artifact.generationSummary, userDataDisclosures },
      origin: "edit",
      sourceJobId: null
    }
  };
}

/**
 * 014 (§6): one disclosure per chart PLACEMENT whose intent contains user-provided
 * points (a shared intent placed on N slides yields N entries). `[]` when no chart
 * contains user data.
 */
function collectUserDataDisclosures(
  deck: SlideDeck,
  chartIntents: ChartIntent[] | null
): UserDataDisclosure[] {
  if (!chartIntents) {
    return [];
  }
  const intentsById = new Map(chartIntents.map((intent) => [intent.id, intent]));
  const disclosures: UserDataDisclosure[] = [];
  for (const slide of deck.slides) {
    for (const block of slide.contentBlocks) {
      if (block.kind !== "chart_placeholder" || !block.chartIntentId) {
        continue;
      }
      const intent = intentsById.get(block.chartIntentId);
      if (!intent) {
        continue;
      }
      const userPointCount = intent.sourceFacts.filter(
        (fact) => fact.kind === "user_provided"
      ).length;
      if (userPointCount === 0) {
        continue;
      }
      disclosures.push({
        slideId: slide.id,
        chartIntentId: intent.id,
        chartTitle: intent.title,
        userPointCount,
        totalPointCount: intent.sourceFacts.length
      });
    }
  }
  return disclosures;
}

/**
 * 014 (§6a): review decisions for intents minted by `add_chart(user_data)` in THIS
 * request. Their ids are unique per revision, so appending can never duplicate.
 */
function mintUserDataDecisions(
  operations: ChartOperation[],
  baseRevision: number,
  chartIntents: ChartIntent[] | null
): SlideDeck["reviewReport"]["chartingDecisions"] {
  if (!chartIntents) {
    return [];
  }
  const intentsById = new Map(chartIntents.map((intent) => [intent.id, intent]));
  const decisions: SlideDeck["reviewReport"]["chartingDecisions"] = [];
  for (const [index, operation] of operations.entries()) {
    if (operation.op !== "add_chart" || operation.source.kind !== "user_data") {
      continue;
    }
    const intent = intentsById.get(`chart_user_r${baseRevision}_${index}`);
    if (!intent) {
      continue;
    }
    decisions.push({
      chartIntentId: intent.id,
      decision: `使用者手動建立（${operation.source.visual}）`,
      sourceFacts: intent.sourceFacts.map((fact) => fact.metric?.displayValue ?? fact.value),
      rationale: "使用者於編輯器手動建立"
    });
  }
  return decisions;
}

/** The disclosure line this module owns in `humanReviewNotes` (synced, not appended). */
const USER_DATA_NOTE_PATTERN =
  /^第 \d+ 頁圖表「.*」含使用者提供的數據點（\d+\/\d+），非全數來自來源文件。$/u;

/**
 * 014 (§6a): sync the review report with the current user-data state — recompute
 * the disclosure lines this module owns (so re-edits neither lose nor duplicate
 * them) and append decisions for newly minted user intents. Zero delta when no
 * user data is involved anywhere.
 */
function syncUserDataReview(
  deck: SlideDeck,
  disclosures: UserDataDisclosure[],
  decisions: SlideDeck["reviewReport"]["chartingDecisions"]
): SlideDeck {
  const existingNotes = deck.reviewReport?.humanReviewNotes ?? [];
  const preservedNotes = existingNotes.filter((line) => !USER_DATA_NOTE_PATTERN.test(line));
  const pageBySlideId = new Map(deck.slides.map((slide, index) => [slide.id, index + 1]));
  const disclosureNotes = disclosures.map(
    (entry) =>
      `第 ${pageBySlideId.get(entry.slideId) ?? 0} 頁圖表「${entry.chartTitle}」含使用者提供的數據點（${entry.userPointCount}/${entry.totalPointCount}），非全數來自來源文件。`
  );

  const notesUnchanged =
    disclosureNotes.length === 0 && preservedNotes.length === existingNotes.length;
  if (notesUnchanged && decisions.length === 0) {
    return deck;
  }
  return {
    ...deck,
    reviewReport: {
      ...deck.reviewReport,
      chartingDecisions: [...(deck.reviewReport?.chartingDecisions ?? []), ...decisions],
      humanReviewNotes: [...preservedNotes, ...disclosureNotes]
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
