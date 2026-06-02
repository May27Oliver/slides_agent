import type { SegmentationValidation } from "@/content-core/semantic-segmentation.types";
import type { ChartIntent } from "@/content-core/chart-intent.types";
import type { DeckBrief, GenerationSummary, SlideDeck, SourceSection } from "@/deck/deck.types";

export interface SlideDeckPlannerInput {
  sourceContent: string;
  deckBrief: DeckBrief;
  sourceSections?: SourceSection[];
  segmentationValidation?: SegmentationValidation;
}

export interface GeneratePreviewDeckInput {
  sourceContent: string;
  deckBrief: DeckBrief;
  sourceSections?: SourceSection[];
  segmentationValidation?: SegmentationValidation;
}

export interface GeneratePreviewDeckResult {
  slideDeck: SlideDeck;
  chartIntents: ChartIntent[];
  generationSummary: GenerationSummary;
}
