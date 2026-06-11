import type { ReviewReport } from "@/review/types";
import type { HtmlGenerationValidation } from "@/rendering/html-generation.types";
import type { RenderedChartSummary } from "@/rendering/chart-rendering.types";
import type { SelectedThemeSummary } from "@/design/selected-theme-summary.types";
import type { ThemeSelectionWarning } from "@/design/theme-selection.types";

export type SourceFactKind =
  | "metric"
  | "date"
  | "decision"
  | "risk"
  | "constraint"
  | "claim"
  | "user_provided";

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
  /** user_provided 時 MUST === metric.displayValue（鏡像，014 FR-007）。 */
  value: string;
  /** user_provided 時固定 "使用者於編輯器輸入"。 */
  sourceText: string;
  sourceSectionId?: string;
  /** 014: 結構化數值；存在時 series 抽取 short-circuit 直接採用。 */
  metric?: SourceFactMetric;
  /** 014: 被此 user 點取代的既有 fact id；僅稽核/還原用，非 provenance。 */
  replacesFactId?: string;
}

/** 014: user_provided fact 的結構化數值，domain 自 valueText + unit 導出。 */
export interface SourceFactMetric {
  label: string;
  displayValue: string;
  numericValue: number;
  unit: string | null;
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
  /**
   * 011: honest evidence that a requested/baseline theme axis could not be applied
   * and fell back to the default. Always present; `[]` when every axis applied as
   * requested. The front end surfaces it as "你選的主題已無法使用，該軸已改用預設主題".
   */
  themeSelectionWarnings: ThemeSelectionWarning[];
  /**
   * 014: structured disclosure of charts containing user-provided data points.
   * Always present; `[]` when no chart contains user data (multi-placement
   * shared intents emit one entry per placement slide). The front end surfaces
   * it as 「本圖表含使用者提供的數據點（{n}/{m}）」.
   */
  userDataDisclosures: UserDataDisclosure[];
}

/** 014: 單一圖表放置處的使用者數據揭露（FR-009/FR-010）。 */
export interface UserDataDisclosure {
  slideId: string;
  chartIntentId: string;
  chartTitle: string;
  userPointCount: number;
  totalPointCount: number;
}
