import type { SourceSection } from "@/deck/types";

export type SourceQuoteRole = "heading" | "body" | "bullet" | "table" | "quote";
export type SegmentationConfidence = "high" | "medium" | "low";

export interface SourceQuote {
  text: string;
  role: SourceQuoteRole;
}

export interface SemanticSegment {
  id: string;
  heading: string;
  sourceQuotes: SourceQuote[];
  summary: string;
  order: number;
  rationale: string;
  confidence: SegmentationConfidence;
  warnings: string[];
}

export interface SemanticSegmentationOutput {
  segments: SemanticSegment[];
  globalWarnings: string[];
}

export interface SegmentationValidation {
  schemaValid: boolean;
  quoteGroundingValid: boolean;
  sourceOrderValid: boolean;
  importantContentCoverageValid: boolean;
  fallbackUsed: boolean;
  issues: string[];
}

export interface SegmentedSourceContent {
  sections: Array<SourceSection & { segmentationSource: "llm" | "deterministic_fallback" }>;
  validation: SegmentationValidation;
}
