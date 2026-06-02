import { ChartIntentPlanner } from "@/content-core/chart-intent-planner";
import { extractSourceFacts } from "@/content-core/source-fact-extractor";
import type { SegmentationValidation } from "@/content-core/semantic-segmentation.types";
import { segmentSourceContent } from "@/content-core/semantic-segmentation-validator";
import type {
  GeneratePreviewDeckInput,
  GeneratePreviewDeckResult
} from "@/deck/deck-generation.types";
import { planSlideDeck } from "@/deck/slide-deck-planner";

export function generatePreviewDeck(input: GeneratePreviewDeckInput): GeneratePreviewDeckResult {
  const segmentation = input.sourceSections
    ? {
        sections: input.sourceSections,
        validation: input.segmentationValidation ?? validExternalSegmentation()
      }
    : segmentSourceContent({ sourceContent: input.sourceContent });
  const facts = extractSourceFacts(input.sourceContent, segmentation.sections);
  const chartIntents = new ChartIntentPlanner().plan({
    sourceFacts: facts,
    ...(input.deckBrief.chartEmphasis ? { chartEmphasis: input.deckBrief.chartEmphasis } : {})
  });
  const slideDeck = planSlideDeck({
    sourceContent: input.sourceContent,
    deckBrief: input.deckBrief,
    sourceSections: segmentation.sections,
    segmentationValidation: segmentation.validation
  });

  return {
    slideDeck,
    chartIntents: chartIntents.intents,
    generationSummary: {
      slideCount: slideDeck.slides.length,
      sourceFactCount: facts.length,
      chartIntentCount: chartIntents.intents.length,
      uncertainClaimCount: slideDeck.reviewReport.uncertainClaims.length
    }
  };
}

function validExternalSegmentation(): SegmentationValidation {
  return {
    schemaValid: true,
    quoteGroundingValid: true,
    sourceOrderValid: true,
    importantContentCoverageValid: true,
    fallbackUsed: false,
    issues: []
  };
}
