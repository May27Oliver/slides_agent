import type { ChartIntent } from "@/content-core/chart-intent.types";
import type { DeckBrief, SourceFact, SourceSection } from "@/deck/deck.types";

export interface CreateDeckPlanProposalInput {
  sourceSections: SourceSection[];
  sourceFacts: SourceFact[];
  chartIntents: ChartIntent[];
  deckBrief: DeckBrief;
}
