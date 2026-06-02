import type { ChartIntent } from "@/content-core/chart-intent.types";
import type {
  DeckBrief,
  DeckPlanProposal,
  SlideDeck,
  SourceFact,
  SourceSection
} from "@/deck/deck.types";
import type { ReviewReport } from "@/review/types";

export interface CompileDeckPlanProposalInput {
  proposal: DeckPlanProposal;
  sourceSections: Array<Pick<SourceSection, "id">>;
  sourceFacts: Array<Pick<SourceFact, "id">>;
  chartIntents: Array<Pick<ChartIntent, "id">>;
  deckBrief: DeckBrief;
  reviewReport?: ReviewReport;
}

export type CompileDeckPlanProposalResult =
  | { ok: true; slideDeck: SlideDeck }
  | { ok: false; fallbackRequired: true; issues: string[] };

export interface DeckReferenceIndex {
  sourceSectionIds: Set<string>;
  sourceFactIds: Set<string>;
  chartIntentIds: Set<string>;
  traceIds: Set<string>;
}
