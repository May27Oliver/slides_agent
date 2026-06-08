import type { ReviewReport } from "@/review/types";
import type { HtmlGenerationValidation } from "@/rendering/html-generation.types";
import type { RenderedChartSummary } from "@/rendering/chart-rendering.types";
import type { SelectedThemeSummary } from "@/design/selected-theme-summary.types";

export type SourceFactKind = "metric" | "date" | "decision" | "risk" | "constraint" | "claim";

export interface SourceContent {
  rawText: string;
  sections: SourceSection[];
  facts: SourceFact[];
}

export interface SourceSection {
  id: string;
  heading: string;
  text: string;
  segmentationSource?: "llm" | "deterministic_fallback";
}

export interface SourceFact {
  id: string;
  kind: SourceFactKind;
  value: string;
  sourceText: string;
  sourceSectionId?: string;
}

export interface DeckBrief {
  purpose: string;
  audience: string;
  styleDirection?: string;
  chartEmphasis?: string;
  segmentationGuidance?: string;
  language?: string;
}

export type SlideType =
  | "title"
  | "section"
  | "content"
  | "comparison"
  | "timeline"
  | "table"
  | "metrics"
  | "quote"
  | "action";

export type ContentBlockKind =
  | "paragraph"
  | "bullets"
  | "metric"
  | "table"
  | "timeline"
  | "callout"
  | "quote"
  | "chart_placeholder"
  | "fallback_text";

export interface ContentBlock {
  kind: ContentBlockKind;
  content: Record<string, unknown>;
  chartIntentId?: string;
}

export type SlideKind = "opening" | "content" | "closing";

export type SlideOutlineEmphasis =
  | "main_point"
  | "evidence"
  | "risk"
  | "decision"
  | "action"
  | "context";

export interface SlideOutlineItem {
  text: string;
  sourceTrace: string[];
  emphasis: SlideOutlineEmphasis;
}

export interface LayoutIntent {
  priority:
    | "message_first"
    | "metrics_first"
    | "comparison"
    | "timeline"
    | "risk_matrix"
    | "table_dense";
  density: "low" | "medium" | "high";
  emphasis: "narrative" | "numbers" | "risks" | "decisions" | "actions";
}

export interface DeckPlanProposal {
  title: string;
  subtitle?: string;
  slides: DeckSlideProposal[];
  planningNotes: string[];
}

export interface DeckSlideProposal {
  id: string;
  slideKind: SlideKind;
  title: string;
  message: string;
  sourceSectionIds: string[];
  sourceFactIds: string[];
  chartIntentIds: string[];
  outline: SlideOutlineItem[];
  layoutIntent: LayoutIntent;
  speakerNotesDraft: string;
  reviewNotes: string[];
}

export interface Slide {
  id: string;
  slideKind: SlideKind;
  type: SlideType;
  title: string;
  message: string;
  outline: SlideOutlineItem[];
  layout: string;
  layoutIntent: LayoutIntent;
  contentBlocks: ContentBlock[];
  sourceTrace: string[];
  speakerNotesDraft: string;
}

export interface SlideDeck {
  id: string;
  title: string;
  subtitle?: string;
  purpose: string;
  audience: string;
  slides: Slide[];
  reviewReport: ReviewReport;
}

export interface PreviewArtifact {
  html: string;
  htmlGenerationValidation: HtmlGenerationValidation;
  generationSummary: GenerationSummary;
}

/**
 * Planning-stage summary: the deck counts known BEFORE the deck is rendered (no
 * theme selected, no charts drawn yet). The pipeline's render stage upgrades this
 * to a full `GenerationSummary`. Kept separate so the public response contract can
 * require `selectedTheme`/`renderedCharts` without weakening it for planning (009).
 */
export interface PreRenderSummary {
  slideCount: number;
  sourceFactCount: number;
  chartIntentCount: number;
  uncertainClaimCount: number;
}

export interface GenerationSummary extends PreRenderSummary {
  /**
   * 007/009: the theme selectTheme + composeKit actually applied, projected as
   * readonly result evidence (kitName, three axis ids, accent swatches, fonts,
   * density, structure features). `fallback` is true when any axis fell back to
   * the default kit. Always present on a rendered (pipeline) summary.
   */
  selectedTheme: SelectedThemeSummary;
  /**
   * 009: per-chart render evidence collected during the single deck render pass.
   * Always present; `[]` when the deck has no charts.
   */
  renderedCharts: RenderedChartSummary[];
}
