import type { PreviewArtifact, SlideDeck } from "@/deck/deck.types";
import { buildGenerationSummary } from "@/deck/generation-summary";
import type { DesignPlanningResult } from "@/design/types";
import type { HtmlGenerationPort } from "@/rendering/html-generator.port";
import { buildHtmlGenerationPrompt } from "@/rendering/html-generation-prompt";
import { validateGeneratedHtml } from "@/rendering/html-generation-validator";
import type { HtmlGenerationValidation } from "@/rendering/html-generation.types";
import { renderFallbackHtmlDeck } from "@/rendering/fallback-html-renderer";

export interface HtmlDeckGenerationInput {
  deck: SlideDeck;
  designPlanningResult: DesignPlanningResult;
}

export interface HtmlDeckGenerator {
  generate(input: HtmlDeckGenerationInput): Promise<PreviewArtifact>;
}

export interface LlmAssistedHtmlDeckGeneratorOptions {
  htmlGenerationPort?: HtmlGenerationPort;
}

export class LlmAssistedHtmlDeckGenerator implements HtmlDeckGenerator {
  constructor(private readonly options: LlmAssistedHtmlDeckGeneratorOptions = {}) {}

  async generate(input: HtmlDeckGenerationInput): Promise<PreviewArtifact> {
    if (!this.options.htmlGenerationPort) {
      return fallbackArtifact(input, { repairAttempted: false });
    }

    const prompt = buildHtmlGenerationPrompt(input);
    const generatedHtml = await this.options.htmlGenerationPort.generateHtml({
      deck: input.deck,
      designPlanningResult: input.designPlanningResult,
      prompt: `${prompt.system}\n\n${prompt.user}\n\n${prompt.responseContract}`
    });
    const initialValidation = validateGeneratedHtml({
      html: generatedHtml,
      deck: input.deck,
      designPlanningResult: input.designPlanningResult
    });

    if (initialValidation.status === "pass") {
      return artifact(input, generatedHtml, initialValidation);
    }

    if (this.options.htmlGenerationPort.repairHtml) {
      const repairedHtml = await this.options.htmlGenerationPort.repairHtml({
        deck: input.deck,
        designPlanningResult: input.designPlanningResult,
        invalidHtml: generatedHtml,
        validationIssues: validationIssues(initialValidation)
      });
      const repairedValidation = validateGeneratedHtml({
        html: repairedHtml,
        deck: input.deck,
        designPlanningResult: input.designPlanningResult
      });

      if (repairedValidation.status === "pass") {
        return artifact(input, repairedHtml, {
          ...repairedValidation,
          repairAttempted: true
        });
      }

      return fallbackArtifact(input, { repairAttempted: true });
    }

    return fallbackArtifact(input, { repairAttempted: false });
  }
}

function artifact(
  input: HtmlDeckGenerationInput,
  html: string,
  htmlGenerationValidation: HtmlGenerationValidation
): PreviewArtifact {
  return {
    html,
    htmlGenerationValidation,
    generationSummary: buildGenerationSummary(input.deck)
  };
}

function fallbackArtifact(
  input: HtmlDeckGenerationInput,
  options: { repairAttempted: boolean }
): PreviewArtifact {
  const html = renderFallbackHtmlDeck(input);
  const validation = validateGeneratedHtml({
    html,
    deck: input.deck,
    designPlanningResult: input.designPlanningResult
  });

  return artifact(input, html, {
    ...validation,
    status: "fallback_used",
    repairAttempted: options.repairAttempted,
    fallbackUsed: true
  });
}

function validationIssues(validation: HtmlGenerationValidation): string[] {
  return [
    ...validation.externalResourceIssues,
    ...validation.contentIssues,
    ...validation.designIssues,
    ...(validation.speakerNotesHidden ? [] : ["Speaker notes are rendered in presentation view."]),
    ...(validation.keyboardNavigationPresent ? [] : ["Keyboard navigation is missing."])
  ];
}
