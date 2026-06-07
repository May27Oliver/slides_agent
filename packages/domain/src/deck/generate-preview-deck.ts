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
  const planning = planSlideDeck({
    sourceContent: input.sourceContent,
    deckBrief: input.deckBrief,
    sourceSections: segmentation.sections,
    segmentationValidation: segmentation.validation
  });

  return {
    slideDeck: planning.slideDeck,
    chartIntents: planning.chartIntents,
    generationSummary: {
      slideCount: planning.slideDeck.slides.length,
      sourceFactCount: planning.sourceFacts.length,
      chartIntentCount: planning.chartIntents.length,
      uncertainClaimCount: planning.slideDeck.reviewReport.uncertainClaims.length
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
