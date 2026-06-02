import type { SourceFact } from "@/deck/deck.types";

export type VisualizationType =
  | "metric_card"
  | "comparison"
  | "timeline"
  | "milestone"
  | "callout"
  | "table"
  | "none";

export interface ChartIntent {
  id: string;
  title: string;
  sourceFacts: SourceFact[];
  recommendedVisuals: VisualizationType[];
  rationale: string;
  userEmphasisMatched: boolean;
}

export interface ChartIntentInput {
  sourceFacts: SourceFact[];
  chartEmphasis?: string;
}

export interface ChartIntentPlannerResult {
  intents: ChartIntent[];
  fallbackNotes: string[];
}
