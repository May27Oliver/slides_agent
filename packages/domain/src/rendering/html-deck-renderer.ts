import type { ChartIntent } from "@/content-core/chart-intent.types";
import type { GenerationSummary, PreviewArtifact, SlideDeck } from "@/deck/deck.types";
import { buildGenerationSummary } from "@/deck/generation-summary";
import type { DesignPlanningResult } from "@/design/types";
import type { ThemeSelectionWarning } from "@/design/theme-selection.types";
import { validateGeneratedHtml } from "@/rendering/html-generation-validator";
import { renderTemplateDeck } from "@/rendering/template-html-renderer";

export interface HtmlDeckGenerationInput {
  deck: SlideDeck;
  designPlanningResult: DesignPlanningResult;
  /** 008: planned chart intents (source facts) used to draw real chart visuals. */
  chartIntents?: ChartIntent[];
  /** 007/009: the applied theme projected as readonly summary evidence (FR-005). */
  selectedTheme: GenerationSummary["selectedTheme"];
  /** 011: per-axis fallback warnings from applyThemeSelection; defaults to []. */
  themeSelectionWarnings?: ThemeSelectionWarning[];
}

/**
 * Renders the deterministic, reference-grade template deck (no LLM call).
 * Fast, free, and always validation-clean — this is the pipeline's html stage.
 */
export function renderTemplateDeckArtifact(input: HtmlDeckGenerationInput): PreviewArtifact {
  // 009: the single deck render pass yields both the html and the per-chart
  // result evidence; the evidence flows into generationSummary.renderedCharts.
  const { html, renderedCharts } = renderTemplateDeck({
    deck: input.deck,
    designPlanningResult: input.designPlanningResult,
    ...(input.chartIntents ? { chartIntents: input.chartIntents } : {})
  });
  const validation = validateGeneratedHtml({
    html,
    deck: input.deck,
    designPlanningResult: input.designPlanningResult
  });

  return {
    html,
    htmlGenerationValidation: {
      ...validation,
      repairAttempted: false,
      fallbackUsed: false
    },
    generationSummary: buildGenerationSummary(
      input.deck,
      renderedCharts,
      input.selectedTheme,
      input.themeSelectionWarnings ?? []
    )
  };
}
