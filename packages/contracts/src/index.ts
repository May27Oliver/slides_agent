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

export {
  validateLoginRequest,
  type LoginRequestContract,
  type AuthUserContract,
  type LoginResponseContract,
  type MeResponseContract,
  type AuthErrorContract,
  type LoginRequestError,
  type LoginRequestValidationResult
} from "./auth";

export {
  type OpenApiSchema,
  DECK_BRIEF_SCHEMA,
  GENERATE_PREVIEW_REQUEST_SCHEMA,
  GENERATE_PREVIEW_RESPONSE_SCHEMA,
  CREATE_PREVIEW_JOB_RESPONSE_SCHEMA,
  PREVIEW_JOB_STATUS_RESPONSE_SCHEMA,
  PREVIEW_REQUEST_ERROR_SCHEMA,
  INVALID_JOB_ID_ERROR_SCHEMA,
  PREVIEW_JOB_UNAVAILABLE_SCHEMA,
  PREVIEW_QUEUE_UNAVAILABLE_SCHEMA,
  DECK_LIST_RESPONSE_SCHEMA,
  DECK_DETAIL_RESPONSE_SCHEMA,
  INVALID_DECK_ID_ERROR_SCHEMA,
  DECK_NOT_FOUND_SCHEMA,
  AUTH_REQUIRED_SCHEMA
} from "./openapi";

export {
  validateDeckListResponse,
  validateDeckDetailResponse,
  type DeckSummaryContract,
  type DeckListResponseContract,
  type DeckRevisionContract,
  type DeckDetailResponseContract,
  type DeckNotFoundContract,
  type DeckContractValidationResult
} from "./deck";

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
