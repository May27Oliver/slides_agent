import type { DeckRevisionContract } from "@slides-agent/contracts";
import type { SlideDeck } from "@slides-agent/domain";

/**
 * A small render-clean revision for editor tests. Mirrors the domain rendering
 * fixtures; kept local because the domain test fixtures can't cross the package
 * boundary. `slideDeck`/`designPlan` here are real domain shapes the renderer reads.
 */
export const fixtureSlideDeck: SlideDeck = {
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
        { text: "Onboarding conversion 從 18% 提升到 25%", emphasis: "evidence", sourceTrace: ["f1"] },
        { text: "客服首次回覆時間從 12 小時降到 4 小時", emphasis: "evidence", sourceTrace: ["f2"] }
      ],
      layout: "content-summary",
      layoutIntent: { priority: "metrics_first", density: "high", emphasis: "numbers" },
      contentBlocks: [],
      sourceTrace: ["section_goal"],
      speakerNotesDraft: "Speaker-only source-grounded notes must stay hidden."
    }
  ],
  reviewReport: {
    assumptions: [],
    omittedOrCompressedContent: [],
    uncertainClaims: [],
    chartingDecisions: [],
    humanReviewNotes: []
  } as unknown as SlideDeck["reviewReport"]
};

export const fixtureRevision: DeckRevisionContract = {
  revision: 1,
  slideDeck: fixtureSlideDeck,
  designPlan: {
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
    consistencyValidation: { ok: true, checkedSlideIds: ["slide_001"], issues: [], fallbackUsed: false }
  },
  html: "<gen/>",
  generationSummary: {
    slideCount: 1,
    sourceFactCount: 2,
    chartIntentCount: 0,
    uncertainClaimCount: 0,
    renderedCharts: [],
    selectedTheme: { kitName: "brief-directed-planning", fallback: false }
  },
  chartIntents: null,
  origin: "generation",
  sourceJobId: "job_1",
  createdAt: "2026-06-05T00:00:00.000Z"
};
