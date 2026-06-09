import type { GenerationSummary, SlideDeck } from "@/deck/deck.types";
import type { ThemeSelectionWarning } from "@/design/theme-selection.types";
import type { RenderedChartSummary } from "@/rendering/chart-rendering.types";

export function buildGenerationSummary(
  deck: SlideDeck,
  renderedCharts: RenderedChartSummary[],
  selectedTheme: GenerationSummary["selectedTheme"],
  // 011: per-axis fallback evidence. Defaults to [] (no manual selection / all
  // axes applied); the generation + edit paths pass applyThemeSelection's warnings.
  themeSelectionWarnings: ThemeSelectionWarning[] = []
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
    renderedCharts,
    selectedTheme,
    themeSelectionWarnings
  };
}
