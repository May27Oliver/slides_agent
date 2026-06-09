/**
 * A small, render-clean deck + design plan for API-layer edit tests. Mirrors the
 * domain rendering fixtures (which can't be imported across packages because of
 * their `@/` paths). Shapes are intentionally loose (`unknown`) — the persistence
 * boundary stores these opaquely and `applyDeckEdit` casts them back.
 */

export const renderableSlideDeck: unknown = {
  id: "deck_local_001",
  title: "PM planning review",
  purpose: "PM planning review",
  audience: "Product and engineering leads",
  slides: [
    {
      id: "slide_001",
      slideKind: "content",
      type: "metrics",
      title: "目標: conversion and response time",
      message: "目標",
      outline: [
        {
          text: "Onboarding conversion 從 18% 提升到 25%",
          emphasis: "evidence",
          sourceTrace: ["fact_conversion"]
        },
        {
          text: "客服首次回覆時間從 12 小時降到 4 小時",
          emphasis: "evidence",
          sourceTrace: ["fact_response_time"]
        }
      ],
      layout: "content-summary",
      layoutIntent: { priority: "metrics_first", density: "high", emphasis: "numbers" },
      contentBlocks: [],
      sourceTrace: ["section_goal", "fact_conversion", "fact_response_time"],
      speakerNotesDraft: "Speaker-only source-grounded notes must stay hidden."
    }
  ],
  reviewReport: {
    assumptions: [],
    omittedOrCompressedContent: [],
    uncertainClaims: [],
    chartingDecisions: [],
    humanReviewNotes: []
  }
};

export const renderableDesignPlan: unknown = {
  designSystem: {
    themeName: "brief-directed-planning",
    palette: {
      background: "#f7f7f2",
      surface: "#ffffff",
      text: "#1f2933",
      mutedText: "#5b6770",
      accent: "#0f766e",
      warning: "#b45309"
    },
    typography: {
      headingFamily: "Inter, system-ui, sans-serif",
      bodyFamily: "Inter, system-ui, sans-serif",
      scale: "compact"
    },
    spacing: { unit: 8, slidePadding: 48, blockGap: 16 },
    visualDensity: "high",
    slidePatterns: ["metric-comparison"]
  },
  slidePatternAssignments: [
    {
      slideId: "slide_001",
      primaryPattern: "metric-comparison",
      density: "high",
      layoutIntent: { priority: "metrics_first", density: "high", emphasis: "numbers" },
      rationale: "Use metric comparison for numeric goals."
    }
  ],
  chartTreatmentPlans: [],
  visualHierarchyPlans: [],
  accessibilityNotes: {
    minContrastRatio: 4.5,
    colorContrastNotes: [],
    readingOrderNotes: [],
    keyboardNavigationNotes: [],
    manualVerificationNotes: []
  },
  designReviewNotes: {
    styleDirectionInterpretation: [],
    visualDensityDecision: "Use high density.",
    rejectedSuggestions: [],
    htmlGenerationConstraints: [],
    manualVerificationNotes: []
  },
  consistencyValidation: {
    ok: true,
    checkedSlideIds: ["slide_001"],
    issues: [],
    fallbackUsed: false
  }
};

/** Minimal generation summary carrying the theme evidence applyDeckEdit reuses. */
export const renderableGenerationSummary: unknown = {
  slideCount: 1,
  sourceFactCount: 2,
  chartIntentCount: 0,
  uncertainClaimCount: 0,
  renderedCharts: [],
  selectedTheme: { kitName: "brief-directed-planning", fallback: false }
};
