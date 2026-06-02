import { describe, expect, it } from "vitest";
import {
  buildUiUxProMaxDesignPlanningPrompt,
  UiUxProMaxDesignPlanningAdapter
} from "../../src/adapters/ui-ux-pro-max/ui-ux-pro-max.adapter";
import type { DesignPlanningResult } from "@slides-agent/domain";

const deckBrief = {
  purpose: "PM planning review",
  audience: "Product and engineering leads",
  styleDirection: "高密度 PM planning deck",
  chartEmphasis: "Highlight KPI changes",
  language: "zh-TW"
};

const slideDeck = {
  id: "deck_local_001",
  title: "PM planning review",
  purpose: deckBrief.purpose,
  audience: deckBrief.audience,
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
      speakerNotesDraft: "Speaker notes stay hidden."
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

const chartIntents = [
  {
    id: "chart_goal_metrics",
    title: "Conversion goal",
    sourceFacts: [
      {
        id: "fact_conversion",
        kind: "metric",
        value: "18% to 25%",
        sourceText: "Onboarding conversion 從 18% 提升到 25%",
        sourceSectionId: "section_goal"
      }
    ],
    recommendedVisuals: ["metric_card", "comparison"],
    rationale: "Before/after KPI change."
  }
];

describe("ui-ux-pro-max design planning adapter", () => {
  it("builds a schema-bound prompt from deck, brief, chart intents, layout intents, renderer tokens, and source-fidelity constraints", () => {
    const prompt = buildUiUxProMaxDesignPlanningPrompt({
      slideDeck: slideDeck as never,
      deckBrief,
      chartIntents: chartIntents as never
    });

    expect(prompt).toContain("Return DesignPlanningResult JSON only.");
    expect(prompt).toContain("DESIGN_PLANNING_RESULT_SCHEMA");
    expect(prompt).toContain("SUPPORTED_RENDERER_TOKENS");
    expect(prompt).toContain("SOURCE_FIDELITY_CONSTRAINTS");
    expect(prompt).toContain("高密度 PM planning deck");
    expect(prompt).toContain('"layoutIntent"');
    expect(prompt).toContain('"chart_goal_metrics"');
    expect(prompt).not.toContain("OPENAI_API_KEY");
  });

  it("calls the backend-owned LLM model and returns DesignPlanningResult without provider/model/key public fields", async () => {
    const generatedResult = designPlanningResult();
    const calls: unknown[] = [];
    const adapter = new UiUxProMaxDesignPlanningAdapter({
      model: "design-model",
      client: {
        complete: async (input) => {
          calls.push(input);
          return JSON.stringify(generatedResult);
        }
      }
    });

    const result = await adapter.generateDesignPlanningResult({
      slideDeck: slideDeck as never,
      deckBrief,
      chartIntents: chartIntents as never
    });

    expect(result).toEqual(generatedResult);
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({
      model: "design-model",
      operation: "design_planning"
    });
    expect(JSON.stringify(result)).not.toContain("design-model");
    expect(JSON.stringify(result)).not.toContain("provider");
    expect(JSON.stringify(result)).not.toContain("apiKey");
  });
});

function designPlanningResult(): DesignPlanningResult {
  return {
    designSystem: {
      themeName: "llm-designed-operational-review",
      palette: {
        background: "#f8fafc",
        surface: "#ffffff",
        text: "#111827",
        mutedText: "#64748b",
        accent: "#2563eb",
        warning: "#dc2626"
      },
      typography: {
        headingFamily: "Inter, system-ui, sans-serif",
        bodyFamily: "Inter, system-ui, sans-serif",
        scale: "compact"
      },
      spacing: {
        unit: 8,
        slidePadding: 40,
        blockGap: 12
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
        rationale: "Prioritize KPI comparison."
      }
    ],
    chartTreatmentPlans: [
      {
        chartIntentId: "chart_goal_metrics",
        treatment: "metric_card",
        labelingNotes: ["Preserve KPI labels."],
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
      keyboardNavigationNotes: ["Keep keyboard navigation."],
      manualVerificationNotes: ["Inspect overlap."]
    },
    designReviewNotes: {
      styleDirectionInterpretation: ["Dense PM planning deck."],
      visualDensityDecision: "Use high density.",
      rejectedSuggestions: [],
      htmlGenerationConstraints: [
        "HTML generation must consume DesignPlanningResult instead of reinterpreting styleDirection."
      ],
      manualVerificationNotes: ["Inspect visual consistency."]
    },
    consistencyValidation: {
      ok: true,
      checkedSlideIds: ["slide_001"],
      issues: [],
      fallbackUsed: false
    }
  };
}
