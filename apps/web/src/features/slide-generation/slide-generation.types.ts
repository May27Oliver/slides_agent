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
    designSystem?: {
      themeName?: string;
      visualDensity?: string;
      chartStyle?: string;
      layoutGrid?: string;
    };
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
    };
  };
}
