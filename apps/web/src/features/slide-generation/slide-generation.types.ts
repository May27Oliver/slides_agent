export interface SlideGenerationRequest {
  sourceContent: string;
  deckBrief: {
    purpose: string;
    audience: string;
    styleDirection?: string;
    chartEmphasis?: string;
    segmentationGuidance?: string;
    language?: string;
  };
}

export interface GeneratedPreviewArtifact {
  slideDeck: {
    title?: string;
    slides?: Array<{
      id: string;
      title: string;
      message: string;
      outline?: Array<{
        text: string;
        emphasis: string;
        sourceTrace: string[];
      }>;
    }>;
    reviewReport?: {
      assumptions?: string[];
      omittedOrCompressedContent?: string[];
      uncertainClaims?: string[];
      chartingDecisions?: unknown[];
      humanReviewNotes?: string[];
    };
  };
  designPlanningResult: {
    slidePatternAssignments?: Array<{
      slideId: string;
      primaryPattern: string;
      density?: string;
      rationale?: string;
    }>;
    chartTreatmentPlans?: Array<{
      chartIntentId: string;
      treatment: string;
      preservedContext?: string[];
    }>;
    visualHierarchyPlans?: Array<{
      slideId: string;
      primaryMessage: string;
      supportingEvidence?: string[];
    }>;
    designReviewNotes?: {
      styleDirectionInterpretation?: string[];
      visualDensityDecision?: string;
      rejectedSuggestions?: string[];
      htmlGenerationConstraints?: string[];
      manualVerificationNotes?: string[];
    };
    consistencyValidation?: {
      ok?: boolean;
      checkedSlideIds?: string[];
      issues?: string[];
      fallbackUsed?: boolean;
      fallbackReason?: string;
    };
  };
  previewArtifact: {
    html: string;
    htmlGenerationValidation: {
      status: string;
      selfContained?: boolean;
      slideCountAndOrderPreserved?: boolean;
      contentFidelityPreserved?: boolean;
      designCompliancePreserved?: boolean;
      speakerNotesHidden?: boolean;
      keyboardNavigationPresent?: boolean;
      externalResourceIssues?: string[];
      contentIssues?: string[];
      designIssues?: string[];
      repairAttempted?: boolean;
      fallbackUsed?: boolean;
    };
    generationSummary: {
      slideCount: number;
      sourceFactCount: number;
      chartIntentCount: number;
      uncertainClaimCount: number;
      // 009 readonly result evidence (mirrors the response contract). Optional on
      // the read side so the panel tolerates planning-only / older payloads.
      selectedTheme?: {
        kitName: string;
        ids: { style: string | null; palette: string | null; font: string | null };
        fallback: boolean;
        accentHues: Array<{ name: string; base: string }>;
        fonts: { heading: string; body: string };
        visualDensity?: "low" | "medium" | "high";
        structureFeatures: {
          radiusPx: number;
          shadow: boolean;
          backdropBlurPx?: number;
          glow?: boolean;
          texture?: "grain" | "noise" | "paper";
          animation?: { preset: "aurora" | "mesh"; durationMs: number };
        };
      };
      renderedCharts?: Array<{
        slideId: string;
        chartIntentId: string;
        visualKind:
          | "pie_donut"
          | "line"
          | "bar"
          | "metric_card"
          | "metric_group"
          | "table"
          | "fallback_text";
        fallback: boolean;
        notes: Array<{ code: string; message: string }>;
      }>;
    };
  };
}

export type PreviewJobStatus = "queued" | "running" | "succeeded" | "failed" | "expired";

export type PreviewJobStage =
  | "request_accepted"
  | "queued"
  | "content_planning"
  | "deck_planning"
  | "design_planning"
  | "html_generation"
  | "html_validation"
  | "repair_or_fallback"
  | "completed"
  | "failed";

export interface PreviewJobFailure {
  code: "PREVIEW_JOB_TIMEOUT" | "PREVIEW_GENERATION_FAILED" | "PREVIEW_JOB_UNAVAILABLE";
  message: string;
  failedStage: PreviewJobStage;
  retryable: boolean;
  retryGuidance: string;
}

export interface PreviewJobEvidence {
  stageTransitions: Array<{
    stage: PreviewJobStage;
    at: string;
  }>;
  validationAccepted: boolean;
  fallbackUsed: boolean;
  repairAttempted: boolean;
  finalStatus: PreviewJobStatus;
  failureCategory?: "timeout" | "generation" | "unavailable";
}

export interface CreatePreviewJobResponse {
  jobId: string;
  status: "queued";
  stage: "request_accepted";
  createdAt: string;
  updatedAt: string;
  statusUrl: string;
}

export interface PreviewJobStatusResponse {
  jobId: string;
  status: PreviewJobStatus;
  stage: PreviewJobStage;
  createdAt: string;
  updatedAt: string;
  evidence: PreviewJobEvidence;
  result?: GeneratedPreviewArtifact;
  failure?: PreviewJobFailure;
}
