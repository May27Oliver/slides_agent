import type { ThemeSelectionContract, ThemeSelectionWarningContract } from "./theme-selection";

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
  parseThemeSelection,
  MAX_THEME_ID_CHARS,
  type ThemeSelectionContract,
  type ThemeSelectionWarningContract,
  type ParseThemeSelectionResult
} from "./theme-selection";

export {
  validateLoginRequest,
  validateRegisterRequest,
  passwordMeetsPolicy,
  type LoginRequestContract,
  type AuthUserContract,
  type LoginResponseContract,
  type MeResponseContract,
  type AuthErrorContract,
  type AuthConfigContract,
  type LoginRequestError,
  type LoginRequestValidationResult,
  type RegisterRequestContract,
  type RegisterResponseContract,
  type RegisterRequestValidationResult,
  type RegisterErrorCode,
  type RequestValidationError,
  type PublicAccount,
  type AccountStatusContract,
  type AdminUserListResponse,
  type AdminUpdateUserRequest,
  type AdminSettableStatus,
  type AdminMutationErrorContract,
  type AdminMutationErrorCode
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
  DECK_REVISION_SCHEMA,
  INVALID_DECK_ID_ERROR_SCHEMA,
  DECK_NOT_FOUND_SCHEMA,
  AUTH_REQUIRED_SCHEMA,
  EDIT_REVISION_REQUEST_SCHEMA,
  INVALID_EDIT_SCHEMA,
  REVISION_CONFLICT_SCHEMA,
  THEME_SELECTION_SCHEMA,
  THEME_CATALOG_RESPONSE_SCHEMA,
  CREATE_PPTX_EXPORT_REQUEST_SCHEMA,
  CREATE_PPTX_EXPORT_RESPONSE_SCHEMA,
  PPTX_EXPORT_STATUS_RESPONSE_SCHEMA
} from "./openapi";

export {
  validateDeckListResponse,
  validateDeckDetailResponse,
  validateEditRevisionRequest,
  type DeckSummaryContract,
  type DeckListResponseContract,
  type DeckRevisionContract,
  type DeckDetailResponseContract,
  type DeckNotFoundContract,
  type EditRevisionRequestContract,
  type RevisionConflictContract,
  type InvalidEditContract,
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
  /** 011: optional manual theme override applied at render stage (no extra LLM). */
  themeSelection?: ThemeSelectionContract;
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

/** The 008 chart-rendering review-note code vocabulary (mirrors domain). */
export type ChartRenderingNoteCode =
  | "series_extracted"
  | "series_insufficient"
  | "unit_mismatch"
  | "invalid_pie_total"
  | "time_sort_failed"
  | "table_truncated"
  | "fallback_used"
  | "value_parse_uncertain";

export type ChartVisualKindContract =
  | "pie_donut"
  | "line"
  | "bar"
  | "metric_card"
  | "metric_group"
  | "table"
  | "fallback_text";

/**
 * 009: readonly applied-theme evidence in the response (projection of the
 * composed style kit). The domain `SelectedThemeSummary` is the source of truth;
 * this is the wire mirror — fields are `readonly` so a domain value (deeply
 * readonly) is assignable to it without a copy.
 */
export interface SelectedThemeSummaryContract {
  readonly kitName: string;
  readonly ids: {
    readonly style: string | null;
    readonly palette: string | null;
    readonly font: string | null;
  };
  readonly fallback: boolean;
  readonly accentHues: ReadonlyArray<{ readonly name: string; readonly base: string }>;
  readonly fonts: { readonly heading: string; readonly body: string };
  readonly visualDensity?: "low" | "medium" | "high";
  readonly structureFeatures: {
    readonly radiusPx: number;
    readonly shadow: boolean;
    readonly backdropBlurPx?: number;
    readonly glow?: boolean;
    readonly texture?: "grain" | "noise" | "paper";
    readonly animation?: { readonly preset: "aurora" | "mesh"; readonly durationMs: number };
  };
}

/** 009: per-chart render evidence; `fallback` true only on a real downgrade. */
export interface RenderedChartSummaryContract {
  slideId: string;
  chartIntentId: string;
  visualKind: ChartVisualKindContract;
  fallback: boolean;
  notes: Array<{ code: ChartRenderingNoteCode; message: string }>;
}

/** 014: disclosure of a chart placement whose intent contains user-provided points. */
export interface UserDataDisclosureContract {
  slideId: string;
  chartIntentId: string;
  chartTitle: string;
  userPointCount: number;
  totalPointCount: number;
}

export interface GenerationSummaryContract {
  slideCount: number;
  sourceFactCount: number;
  chartIntentCount: number;
  uncertainClaimCount: number;
  /** 007/009: readonly applied-theme evidence; always present on a rendered response. */
  selectedTheme: SelectedThemeSummaryContract;
  /** 009: per-chart render evidence; always present ([] when no charts). */
  renderedCharts: RenderedChartSummaryContract[];
  /** 011: per-axis theme fallback evidence; always present ([] when all applied). */
  themeSelectionWarnings: ThemeSelectionWarningContract[];
  /** 014: user-data disclosures; always present ([] when no chart has user points). */
  userDataDisclosures: UserDataDisclosureContract[];
}

export interface GeneratePreviewResponseContract {
  slideDeck: unknown;
  designPlanningResult: unknown;
  previewArtifact: PreviewArtifactContract;
  /**
   * 010 (C1/FR-006a): the planned chart intents (source facts) used to draw the
   * deck's charts. Surfaced so the persistence path can store them on the revision
   * and the editor can redraw charts deterministically (no re-derivation / no LLM).
   * Opaque array; `[]` when the deck has no charts.
   */
  chartIntents: unknown;
  /**
   * 010: id of the deck persisted from this generation (async job path), so the client
   * can auto-navigate into the editor. Absent on the synchronous preview endpoint.
   */
  deckId?: string | null;
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

// 015 US2: PPTX export job (create / poll / download).
export {
  validateCreatePptxExportRequest,
  validatePptxExportJobStatusResponse,
  type CreatePptxExportRequestContract,
  type CreatePptxExportResponseContract,
  type PptxExportJobStatusContract,
  type PptxExportJobStatusResponseContract,
  type PptxExportValidationResult
} from "./pptx-export-job";
