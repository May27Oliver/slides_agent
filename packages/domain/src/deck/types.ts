import type { DesignSystem } from "@/design/types";
import type { ReviewReport } from "@/review/types";

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

export interface Slide {
  id: string;
  type: SlideType;
  title: string;
  message: string;
  layout: string;
  contentBlocks: ContentBlock[];
  sourceTrace: string[];
  speakerNotes?: string;
}

export interface SlideDeck {
  id: string;
  title: string;
  subtitle?: string;
  purpose: string;
  audience: string;
  designSystem: DesignSystem;
  slides: Slide[];
  reviewReport: ReviewReport;
}

export interface PreviewArtifact {
  html: string;
  generationSummary: GenerationSummary;
}

export interface GenerationSummary {
  slideCount: number;
  sourceFactCount: number;
  chartIntentCount: number;
  uncertainClaimCount: number;
}
