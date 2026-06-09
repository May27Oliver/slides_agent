import type { GeneratedPreviewArtifact } from "@/features/slide-generation/slide-generation.types";
import type { TranslationKey } from "@/i18n";

// The exact 008 visual-kind union the response carries — derived from the read
// model so it can never drift from the artifact shape. Shared by the generated
// charts panel (US2) and the chart preset preview (US3).
export type ChartVisualKind = NonNullable<
  GeneratedPreviewArtifact["previewArtifact"]["generationSummary"]["renderedCharts"]
>[number]["visualKind"];

// Single source of truth for visual-kind → i18n label. The Record is exhaustive,
// so adding a visual kind forces a label here (no silent gaps).
export const CHART_VISUAL_KIND_LABEL_KEY: Record<ChartVisualKind, TranslationKey> = {
  pie_donut: "chart.kind.pie_donut",
  line: "chart.kind.line",
  bar: "chart.kind.bar",
  metric_card: "chart.kind.metric_card",
  metric_group: "chart.kind.metric_group",
  table: "chart.kind.table",
  fallback_text: "chart.kind.fallback_text"
};
