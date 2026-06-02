import { describe, expect, it } from "vitest";
import { loadPendingModule } from "../support/pending-module";
import type { DesignPlanningResult } from "@/design/types";
import type { SlideDeck } from "@/deck/deck.types";

interface HtmlGenerationPromptModule {
  buildHtmlGenerationPrompt(input: {
    deck: SlideDeck;
    designPlanningResult: DesignPlanningResult;
  }): {
    system: string;
    user: string;
    responseContract: string;
  };
}

async function loadPromptModule(): Promise<HtmlGenerationPromptModule> {
  return loadPendingModule<HtmlGenerationPromptModule>("@/rendering/html-generation-prompt");
}

describe("HTML generation prompt", () => {
  it("builds a self-contained HTML prompt from SlideDeck and DesignPlanningResult", async () => {
    const { buildHtmlGenerationPrompt } = await loadPromptModule();
    const prompt = buildHtmlGenerationPrompt({
      deck: sampleDeck,
      designPlanningResult: sampleDesignPlanningResult
    });

    expect(prompt.system).toContain("self-contained HTML");
    expect(prompt.system).toContain(
      "no external CSS, JavaScript, image, font, CDN, or backend dependency"
    );
    expect(prompt.system).toContain(
      "Preserve slide count, slide order, title/message wording, outline meaning"
    );
    expect(prompt.user).toContain('"slideDeck"');
    expect(prompt.user).toContain('"designPlanningResult"');
    expect(prompt.user).toContain('"slide_001"');
    expect(prompt.user).toContain('"slidePatternAssignments"');
    expect(prompt.user).toContain('"metric-comparison"');
    expect(prompt.user).toContain('"chartTreatmentPlans"');
    expect(prompt.user).toContain('"visualHierarchyPlans"');
    expect(prompt.user).toContain('"htmlGenerationConstraints"');
    expect(prompt.user).not.toContain('"deckBrief"');
    expect(prompt.user).not.toContain("高密度 PM planning deck");
    expect(prompt.responseContract).toContain("Return only complete HTML");
  });
});

const sampleDeck: SlideDeck = {
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
        }
      ],
      layout: "content-summary",
      layoutIntent: {
        priority: "metrics_first",
        density: "high",
        emphasis: "numbers"
      },
      contentBlocks: [],
      sourceTrace: ["section_goal", "fact_conversion"],
      speakerNotesDraft: "Do not render this note."
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

const sampleDesignPlanningResult: DesignPlanningResult = {
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
      preservedContext: ["Onboarding conversion 從 18% 提升到 25%"]
    }
  ],
  visualHierarchyPlans: [
    {
      slideId: "slide_001",
      primaryMessage: "目標",
      supportingEvidence: ["Onboarding conversion 從 18% 提升到 25%"],
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
