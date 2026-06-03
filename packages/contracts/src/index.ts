export const SLIDE_GENERATION_SCHEMA_ID = "urn:slides-agent:contracts:slide-generation";

export {
  SEMANTIC_SEGMENTATION_SCHEMA_ID,
  validateSemanticSegmentationOutput,
  type ContractValidationError,
  type SemanticSegmentationValidationResult
} from "./semantic-segmentation";

export {
  validateGeneratePreviewRequest,
  type ContractError,
  type PreviewRequestValidationResult
} from "./preview-request";

export interface DeckBriefContract {
  purpose: string;
  audience: string;
  styleDirection?: string;
  chartEmphasis?: string;
  segmentationGuidance?: string;
  language?: string;
}

export interface GeneratePreviewRequestContract {
  sourceContent: string;
  deckBrief: DeckBriefContract;
}

export interface PreviewArtifactContract {
  html: string;
  htmlGenerationValidation: HtmlGenerationValidationContract;
  generationSummary: GenerationSummaryContract;
}

export interface HtmlGenerationValidationContract {
  status: "pass" | "repair_required" | "fallback_used" | "failed";
  selfContained: boolean;
  slideCountAndOrderPreserved: boolean;
  contentFidelityPreserved: boolean;
  designCompliancePreserved: boolean;
  speakerNotesHidden: boolean;
  keyboardNavigationPresent: boolean;
  externalResourceIssues: string[];
  contentIssues: string[];
  designIssues: string[];
  repairAttempted: boolean;
  fallbackUsed: boolean;
}

export interface GenerationSummaryContract {
  slideCount: number;
  sourceFactCount: number;
  chartIntentCount: number;
  uncertainClaimCount: number;
}

export interface GeneratePreviewResponseContract {
  slideDeck: unknown;
  designPlanningResult: unknown;
  previewArtifact: PreviewArtifactContract;
}

export {
  validateCreatePreviewJobResponse,
  validatePreviewJobStatusResponse,
  type CreatePreviewJobResponseContract,
  type PreviewJobAvailableStatusResponseContract,
  type PreviewJobContractValidationResult,
  type PreviewJobEvidenceContract,
  type PreviewJobFailureContract,
  type PreviewJobStage,
  type PreviewJobStageTransitionContract,
  type PreviewJobStatus,
  type PreviewJobStatusResponseContract,
  type PreviewJobUnavailableResponseContract
} from "./preview-job";
