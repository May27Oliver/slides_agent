import type {
  DeckOutlinePlanner,
  DeckOutlinePlanningPort,
  DeckOutlineRefinement,
  DeckOutlineRefinementInput,
  RefinedSlideOutline
} from "@/deck/deck-outline-planner.port";
import { validateDeckOutlineRefinement } from "@/deck/deck-outline-refinement-validator";
import type { Slide, SlideDeck, SlideOutlineItem } from "@/deck/deck.types";

export interface LlmDeckOutlinePlannerOptions {
  deckOutlinePlanningPort?: DeckOutlinePlanningPort;
}

/**
 * Enriches the deterministic baseline deck with LLM-refined, source-faithful
 * slide outlines. Any failure (missing port, port error, or failed validation)
 * returns the baseline deck unchanged so generation never regresses.
 */
export class LlmDeckOutlinePlanner implements DeckOutlinePlanner {
  constructor(private readonly options: LlmDeckOutlinePlannerOptions = {}) {}

  async plan(input: DeckOutlineRefinementInput): Promise<SlideDeck> {
    if (!this.options.deckOutlinePlanningPort) {
      return input.deck;
    }

    try {
      const refinement = await this.options.deckOutlinePlanningPort.refineDeckOutline(input);
      const validation = validateDeckOutlineRefinement(input, refinement);
      if (!validation.ok) {
        return input.deck;
      }

      return mergeRefinement(input.deck, refinement);
    } catch {
      return input.deck;
    }
  }
}

function mergeRefinement(deck: SlideDeck, refinement: DeckOutlineRefinement): SlideDeck {
  const refinementById = new Map(refinement.slides.map((slide) => [slide.id, slide]));

  return {
    ...deck,
    slides: deck.slides.map((slide) => {
      const refined = refinementById.get(slide.id);
      return refined ? mergeSlide(slide, refined) : slide;
    })
  };
}

function mergeSlide(slide: Slide, refined: RefinedSlideOutline): Slide {
  return {
    ...slide,
    title: refined.title.trim(),
    message: refined.message.trim(),
    outline: refined.bullets.map((bullet, index) => buildOutlineItem(slide, bullet, index))
  };
}

function buildOutlineItem(slide: Slide, bullet: string, index: number): SlideOutlineItem {
  const baselineItem = slide.outline[index] ?? slide.outline[0];
  const sourceTrace =
    baselineItem && baselineItem.sourceTrace.length > 0
      ? baselineItem.sourceTrace
      : slide.sourceTrace;

  return {
    text: bullet.trim(),
    sourceTrace,
    emphasis: baselineItem?.emphasis ?? "main_point"
  };
}
