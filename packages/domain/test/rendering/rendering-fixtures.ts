import type { DesignPlanningResult } from "@/design/types";
import type { SlideDeck } from "@/deck/deck.types";

export const renderingDeck: SlideDeck = {
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
      layoutIntent: {
        priority: "metrics_first",
        density: "high",
        emphasis: "numbers"
      },
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

export const renderingDesignPlanningResult: DesignPlanningResult = {
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
    spacing: {
      unit: 8,
      slidePadding: 48,
      blockGap: 16
    },
    visualDensity: "high",
    layoutGrid: "16:9",
    slidePatterns: ["metric-comparison"],
    chartStyle: "minimal"
  },
  slidePatternAssignments: [
    {
      slideId: "slide_001",
      primaryPattern: "metric-comparison",
      density: "high",
      layoutIntent: {
        priority: "metrics_first",
        density: "high",
        emphasis: "numbers"
      },
      rationale: "Use metric comparison for numeric goals."
    }
  ],
  chartTreatmentPlans: [
    {
      chartIntentId: "chart_goal_metrics",
      treatment: "metric_card",
      labelingNotes: ["Keep original labels."],
      preservedContext: [
        "Onboarding conversion 從 18% 提升到 25%",
        "客服首次回覆時間從 12 小時降到 4 小時"
      ]
    }
  ],
  visualHierarchyPlans: [
    {
      slideId: "slide_001",
      primaryMessage: "目標",
      supportingEvidence: [
        "Onboarding conversion 從 18% 提升到 25%",
        "客服首次回覆時間從 12 小時降到 4 小時"
      ],
      secondaryDetails: [],
      deEmphasizedContent: []
    }
  ],
  accessibilityNotes: {
    minContrastRatio: 4.5,
    colorContrastNotes: ["Use AA contrast."],
    readingOrderNotes: ["slide_001: title, message, supporting content, controls."],
    keyboardNavigationNotes: ["Keep previous/next keyboard navigation available."],
    manualVerificationNotes: ["Check overlap in browser."]
  },
  designReviewNotes: {
    styleDirectionInterpretation: ["Use dense PM planning layout as visual constraints."],
    visualDensityDecision: "Use high density.",
    rejectedSuggestions: [],
    htmlGenerationConstraints: [
      "HTML generation must consume DesignPlanningResult instead of reinterpreting styleDirection."
    ],
    manualVerificationNotes: ["Inspect generated HTML."]
  },
  consistencyValidation: {
    ok: true,
    checkedSlideIds: ["slide_001"],
    issues: [],
    fallbackUsed: false
  }
};

export const validHtml = `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    :root { --accent: #0f766e; }
  </style>
</head>
<body>
  <main class="deck">
    <section class="slide pattern-metric-comparison" data-slide-id="slide_001" data-pattern="metric-comparison">
      <h1>目標: conversion and response time</h1>
      <p class="message">目標</p>
      <ul>
        <li>Onboarding conversion 從 18% 提升到 25%</li>
        <li>客服首次回覆時間從 12 小時降到 4 小時</li>
      </ul>
    </section>
  </main>
  <script>
    document.addEventListener("keydown", (event) => {
      if (event.key === "ArrowRight" || event.key === "PageDown") {}
      if (event.key === "ArrowLeft" || event.key === "PageUp") {}
    });
  </script>
</body>
</html>`;
