import type { GenerationSummary, PreviewArtifact, SlideDeck } from "@/deck/deck.types";
import { buildGenerationSummary } from "@/deck/generation-summary";
import type { DesignPlanningResult } from "@/design/types";
import { validateGeneratedHtml } from "@/rendering/html-generation-validator";
import { renderTemplateDeck } from "@/rendering/template-html-renderer";

export interface HtmlDeckGenerationInput {
  deck: SlideDeck;
  designPlanningResult: DesignPlanningResult;
  /** 007: the three theme axes selectTheme chose, recorded in the summary (FR-013). */
  selectedTheme?: GenerationSummary["selectedTheme"];
}

/**
 * Renders the deterministic, reference-grade template deck (no LLM call).
 * Fast, free, and always validation-clean — this is the pipeline's html stage.
 */
export function renderTemplateDeckArtifact(input: HtmlDeckGenerationInput): PreviewArtifact {
  const html = renderTemplateDeck(input);
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
    generationSummary: buildGenerationSummary(input.deck, input.selectedTheme)
  };
}
