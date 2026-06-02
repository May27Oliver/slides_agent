export interface SemanticSegmenterInput {
  sourceContent: string;
  purpose: string;
  audience: string;
  segmentationGuidance?: string;
}

export interface SemanticSegmenter {
  segment(input: SemanticSegmenterInput): Promise<unknown>;
}

export interface SemanticSegmentationRepairInput {
  sourceContent: string;
  invalidOutput: unknown;
  validationErrors: string[];
}

export interface SemanticSegmentationRepairer {
  repair(input: SemanticSegmentationRepairInput): Promise<unknown>;
}
