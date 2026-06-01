export const SLIDE_GENERATION_SCHEMA_ID = "urn:slides-agent:contracts:slide-generation";

export {
  SEMANTIC_SEGMENTATION_SCHEMA_ID,
  validateSemanticSegmentationOutput,
  type ContractValidationError,
  type SemanticSegmentationValidationResult
} from "@/semantic-segmentation";

export {
  validateGeneratePreviewRequest,
  type ContractError,
  type PreviewRequestValidationResult
} from "@/preview-request";

export interface DeckBriefContract {
  purpose: string;
  audience: string;
  styleDirection?: string;
  chartEmphasis?: string;
  segmentationGuidance?: string;
  language?: string;
  tone?: string;
}

export interface GeneratePreviewRequestContract {
  sourceContent: string;
  deckBrief: DeckBriefContract;
}

export interface PreviewArtifactContract {
  html: string;
  generationSummary: GenerationSummaryContract;
}

export interface GenerationSummaryContract {
  slideCount: number;
  sourceFactCount: number;
  chartIntentCount: number;
  uncertainClaimCount: number;
}

export interface GeneratePreviewResponseContract {
  slideDeck: unknown;
  previewArtifact: PreviewArtifactContract;
}
