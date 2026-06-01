import { ChartIntentPlanner } from "@/content-core/chart-intent-planner";
import { extractSourceFacts } from "@/content-core/source-fact-extractor";
import { segmentSourceContent } from "@/content-core/semantic-segmentation-validator";
import type { GenerationSummary, SlideDeck } from "@/deck/types";
import { planSlideDeck, type DeckBrief } from "@/deck/slide-deck-planner";

export interface GeneratePreviewDeckInput {
  sourceContent: string;
  deckBrief: DeckBrief;
}

export interface GeneratePreviewDeckResult {
  slideDeck: SlideDeck;
  generationSummary: GenerationSummary;
}

export function generatePreviewDeck(input: GeneratePreviewDeckInput): GeneratePreviewDeckResult {
  const segmentation = segmentSourceContent({ sourceContent: input.sourceContent });
  const facts = extractSourceFacts(input.sourceContent, segmentation.sections);
  const chartIntents = new ChartIntentPlanner().plan({
    sourceFacts: facts,
    ...(input.deckBrief.chartEmphasis ? { chartEmphasis: input.deckBrief.chartEmphasis } : {})
  });
  const slideDeck = planSlideDeck(input);

  return {
    slideDeck,
    generationSummary: {
      slideCount: slideDeck.slides.length,
      sourceFactCount: facts.length,
      chartIntentCount: chartIntents.intents.length,
      uncertainClaimCount: slideDeck.reviewReport.uncertainClaims.length
    }
  };
}
