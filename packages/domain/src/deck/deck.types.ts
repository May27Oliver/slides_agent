import type { ReviewReport } from "@/review/types";
import type { HtmlGenerationValidation } from "@/rendering/html-generation.types";

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

export interface GenerationSummary {
  slideCount: number;
  sourceFactCount: number;
  chartIntentCount: number;
  uncertainClaimCount: number;
}
