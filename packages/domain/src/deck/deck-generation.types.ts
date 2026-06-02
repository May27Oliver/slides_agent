import type { DeckBrief, GenerationSummary, SlideDeck } from "@/deck/deck.types";

export interface SlideDeckPlannerInput {
  sourceContent: string;
  deckBrief: DeckBrief;
}

export interface GeneratePreviewDeckInput {
  sourceContent: string;
  deckBrief: DeckBrief;
}

export interface GeneratePreviewDeckResult {
  slideDeck: SlideDeck;
  generationSummary: GenerationSummary;
}
