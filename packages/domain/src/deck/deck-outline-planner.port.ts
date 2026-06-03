import type { DeckBrief, SlideDeck, SourceSection } from "@/deck/deck.types";

export interface DeckOutlineRefinementInput {
  deck: SlideDeck;
  sourceSections: SourceSection[];
  deckBrief: DeckBrief;
}

export interface RefinedSlideOutline {
  id: string;
  title: string;
  message: string;
  bullets: string[];
}

export interface DeckOutlineRefinement {
  slides: RefinedSlideOutline[];
}

export interface DeckOutlineRefinementValidation {
  ok: boolean;
  issues: string[];
}

/**
 * Orchestrates deck outline planning. Implementations enrich the deterministic
 * baseline deck (better titles and source-faithful, non-truncated bullets) when
 * an LLM port is available, and otherwise return the baseline deck unchanged.
 */
export interface DeckOutlinePlanner {
  plan(input: DeckOutlineRefinementInput): Promise<SlideDeck>;
}

/**
 * Low-level LLM port. Given the baseline deck and grounding sections, produce a
 * refined outline per slide. The orchestrating planner validates the result and
 * falls back to the baseline deck if validation fails.
 */
export interface DeckOutlinePlanningPort {
  refineDeckOutline(input: DeckOutlineRefinementInput): Promise<DeckOutlineRefinement>;
}
