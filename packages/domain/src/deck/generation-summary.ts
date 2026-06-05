import type { GenerationSummary, SlideDeck } from "@/deck/deck.types";

export function buildGenerationSummary(
  deck: SlideDeck,
  selectedTheme?: GenerationSummary["selectedTheme"]
): GenerationSummary {
  const sourceTraceIds = new Set(deck.slides.flatMap((slide) => slide.sourceTrace));
  const chartIntentIds = new Set(
    deck.slides.flatMap((slide) =>
      slide.contentBlocks.flatMap((block) => (block.chartIntentId ? [block.chartIntentId] : []))
    )
  );

  return {
    slideCount: deck.slides.length,
    sourceFactCount: sourceTraceIds.size,
    chartIntentCount: chartIntentIds.size,
    uncertainClaimCount: deck.reviewReport.uncertainClaims.length,
    ...(selectedTheme ? { selectedTheme } : {})
  };
}
