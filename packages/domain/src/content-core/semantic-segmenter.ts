import type { SemanticSegmentationOutput } from "@/content-core/semantic-segmentation";

export interface SemanticSegmenterInput {
  sourceContent: string;
  purpose: string;
  audience: string;
  segmentationGuidance?: string;
}

export interface SemanticSegmenter {
  segment(input: SemanticSegmenterInput): Promise<SemanticSegmentationOutput>;
}
