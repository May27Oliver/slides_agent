import { describe, expect, it } from "vitest";
import { UiUxProMaxDesignPlanner } from "@/design/design-planner";
import type { ChartIntent } from "@/content-core/chart-intent.types";
import type { DeckBrief, SlideDeck } from "@/deck/deck.types";
import type { DesignPlanningGenerationPort } from "@/design/design-planner.port";
import type { DesignPlanningResult } from "@/design/design.types";

const deckBrief: DeckBrief = {
  purpose: "PM planning review",
  audience: "Product and engineering leads",
  styleDirection: "高密度 PM planning deck，強調風險、里程碑與 KPI",
  chartEmphasis: "把 conversion、回覆時間、deadline 和 resource risk 做成容易比較的視覺重點",
  language: "zh-TW"
};

const slideDeck: SlideDeck = {
  id: "deck_local_001",
  title: "PM planning review",
  purpose: deckBrief.purpose,
  audience: deckBrief.audience,
  slides: [
    {
      id: "slide_001",
      slideKind: "opening",
      type: "title",
      title: "PM planning review",
      message: "PM planning review",
      outline: [
        {
          text: "Onboarding conversion 從 18% 提升到 25%",
          emphasis: "evidence",
          sourceTrace: ["section_goal", "fact_conversion"]
        }
      ],
      layout: "title-summary",
      layoutIntent: {
        priority: "message_first",
        density: "medium",
        emphasis: "narrative"
      },
      contentBlocks: [],
      sourceTrace: ["section_goal", "fact_conversion"],
      speakerNotesDraft: "請依照來源內容說明 conversion 目標。"
    },
    {
      id: "slide_002",
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
      contentBlocks: [
        {
          kind: "chart_placeholder",
          chartIntentId: "chart_goal_metrics",
          content: {}
        }
      ],
      sourceTrace: ["section_goal", "fact_conversion", "fact_response_time", "chart_goal_metrics"],
      speakerNotesDraft: "請依照來源內容說明 conversion 與回覆時間目標。"
    },
    {
      id: "slide_003",
      slideKind: "content",
      type: "content",
      title: "風險: design resource",
      message: "風險",
      outline: [
        {
          text: "Design resource 只有 0.5 FTE",
          emphasis: "risk",
          sourceTrace: ["fact_design_resource"]
        }
      ],
      layout: "content-summary",
      layoutIntent: {
        priority: "risk_matrix",
        density: "medium",
        emphasis: "risks"
      },
      contentBlocks: [],
      sourceTrace: ["section_risk", "fact_design_resource"],
      speakerNotesDraft: "請依照來源內容說明 design resource risk。"
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

const chartIntents: ChartIntent[] = [
  {
    id: "chart_goal_metrics",
    title: "Conversion and response time goals",
    sourceFacts: [
      {
        id: "fact_conversion",
        kind: "metric",
        value: "18% to 25%",
        sourceText: "Onboarding conversion 從 18% 提升到 25%",
        sourceSectionId: "section_goal"
      },
      {
        id: "fact_response_time",
        kind: "metric",
        value: "12 小時 to 4 小時",
        sourceText: "客服首次回覆時間從 12 小時降到 4 小時",
        sourceSectionId: "section_goal"
      }
    ],
    recommendedVisuals: ["metric_card", "comparison"],
    rationale: "Both facts contain before/after values."
  }
];

describe("design planner", () => {
  it("creates a complete HTML-generation-consumable design planning result without changing deck content", async () => {
    const planner = new UiUxProMaxDesignPlanner();

    const result = await planner.plan({
      slideDeck,
      deckBrief,
      chartIntents
    });

    expect(result.designSystem.visualDensity).toBe("high");
    expect(result.slidePatternAssignments).toHaveLength(slideDeck.slides.length);
    expect(result.slidePatternAssignments.map((assignment) => assignment.slideId)).toEqual([
      "slide_001",
      "slide_002",
      "slide_003"
    ]);
    expect(result.slidePatternAssignments[1]).toMatchObject({
      primaryPattern: "metric-comparison",
      density: "high",
      layoutIntent: slideDeck.slides[1]?.layoutIntent
    });
    expect(result.chartTreatmentPlans[0]).toMatchObject({
      chartIntentId: "chart_goal_metrics",
      treatment: "metric_card",
      preservedContext: [
        "Onboarding conversion 從 18% 提升到 25%",
        "客服首次回覆時間從 12 小時降到 4 小時"
      ]
    });
    expect(result.visualHierarchyPlans[1]).toMatchObject({
      slideId: "slide_002",
      primaryMessage: "目標",
      supportingEvidence: [
        "Onboarding conversion 從 18% 提升到 25%",
        "客服首次回覆時間從 12 小時降到 4 小時"
      ]
    });
    expect(result.accessibilityNotes.minContrastRatio).toBeGreaterThanOrEqual(4.5);
    expect(result.designReviewNotes.styleDirectionInterpretation.join(" ")).toContain("高密度");
    expect(result.designReviewNotes.htmlGenerationConstraints).toContain(
      "HTML generation must consume DesignPlanningResult instead of reinterpreting styleDirection."
    );
    expect(result.consistencyValidation).toMatchObject({
      ok: true,
      fallbackUsed: true,
      fallbackReason: "No ui-ux-pro-max design planning port was configured.",
      checkedSlideIds: ["slide_001", "slide_002", "slide_003"]
    });

    expect(slideDeck.slides.map((slide) => slide.title)).toEqual([
      "PM planning review",
      "目標: conversion and response time",
      "風險: design resource"
    ]);
  });

  it("uses ui-ux-pro-max LLM planning as the core design system source instead of keyword heuristics", async () => {
    const generatedResult = uiUxProMaxGeneratedDesignResult();
    const designPlanningPort: DesignPlanningGenerationPort = {
      generateDesignPlanningResult: async (input) => {
        expect(input.slideDeck.id).toBe("deck_local_001");
        expect(input.deckBrief.styleDirection).toContain("高密度");
        expect(input.chartIntents).toHaveLength(1);

        return generatedResult;
      }
    };
    const planner = new UiUxProMaxDesignPlanner({ designPlanningPort });

    const result = await planner.plan({
      slideDeck,
      deckBrief,
      chartIntents
    });

    // 007: the planner preserves the LLM result verbatim as the core design
    // source and no longer attaches a styleKit — slides.service runs the
    // mandatory selectTheme step and supplies styleKit on both paths (DR-002).
    expect(result.designSystem).toBe(generatedResult.designSystem);
    expect(result.slidePatternAssignments).toBe(generatedResult.slidePatternAssignments);
    expect(result.styleKit).toBeUndefined();
    expect(result.designSystem.themeName).toBe("llm-designed-operational-review");
    expect(result.designSystem.chartStyle).toBe("ui-ux-pro-max-dashboard");
    expect(result.designSystem.palette).toMatchObject({
      background: "#f8fafc",
      accent: "#2563eb",
      warning: "#dc2626"
    });
    expect(result.designReviewNotes.styleDirectionInterpretation).toContain(
      "ui-ux-pro-max interpreted the style direction as an operational KPI review."
    );
    expect(result.designReviewNotes.rejectedSuggestions).not.toContain(
      "Using fixed fallback design system as the primary style source."
    );
    expect(result.consistencyValidation.fallbackUsed).toBe(false);
  });

  it("falls back when ui-ux-pro-max LLM planning omits required slide evidence", async () => {
    const invalidGeneratedResult = uiUxProMaxGeneratedDesignResult({
      slidePatternAssignments: []
    });
    const designPlanningPort: DesignPlanningGenerationPort = {
      generateDesignPlanningResult: async () => invalidGeneratedResult
    };
    const planner = new UiUxProMaxDesignPlanner({ designPlanningPort });

    const result = await planner.plan({
      slideDeck,
      deckBrief,
      chartIntents
    });

    expect(result).not.toBe(invalidGeneratedResult);
    expect(result.designSystem.themeName).toBe("brief-directed-planning");
    expect(result.consistencyValidation).toMatchObject({
      ok: false,
      fallbackUsed: true,
      fallbackReason: "Generated design planning result failed deterministic validation."
    });
    expect(result.consistencyValidation.issues).toContain(
      "Missing slide pattern assignment: slide_001"
    );
  });
});

function uiUxProMaxGeneratedDesignResult(
  overrides: Partial<DesignPlanningResult> = {}
): DesignPlanningResult {
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
      layoutGrid: "16:9 ui-ux-pro-max grid",
      slidePatterns: [
        "title-summary",
        "content-summary",
        "metric-comparison",
        "risk-matrix",
        "action-summary"
      ],
      chartStyle: "ui-ux-pro-max-dashboard"
    },
    slidePatternAssignments: [
      {
        slideId: "slide_001",
        primaryPattern: "title-summary",
        density: "medium",
        layoutIntent: slideDeck.slides[0]!.layoutIntent,
        rationale: "Open with a compact planning frame."
      },
      {
        slideId: "slide_002",
        primaryPattern: "metric-comparison",
        density: "high",
        layoutIntent: slideDeck.slides[1]!.layoutIntent,
        rationale: "Prioritize KPI comparisons from ChartIntent."
      },
      {
        slideId: "slide_003",
        primaryPattern: "risk-matrix",
        density: "medium",
        layoutIntent: slideDeck.slides[2]!.layoutIntent,
        rationale: "Use a risk-first pattern for resource constraints."
      }
    ],
    chartTreatmentPlans: [
      {
        chartIntentId: "chart_goal_metrics",
        treatment: "metric_card",
        labelingNotes: ["Keep conversion and response-time units visible."],
        preservedContext: [
          "Onboarding conversion 從 18% 提升到 25%",
          "客服首次回覆時間從 12 小時降到 4 小時"
        ]
      }
    ],
    visualHierarchyPlans: [
      {
        slideId: "slide_001",
        primaryMessage: "PM planning review",
        supportingEvidence: ["Onboarding conversion 從 18% 提升到 25%"],
        secondaryDetails: [],
        deEmphasizedContent: []
      },
      {
        slideId: "slide_002",
        primaryMessage: "目標",
        supportingEvidence: [
          "Onboarding conversion 從 18% 提升到 25%",
          "客服首次回覆時間從 12 小時降到 4 小時"
        ],
        secondaryDetails: [],
        deEmphasizedContent: []
      },
      {
        slideId: "slide_003",
        primaryMessage: "風險",
        supportingEvidence: ["Design resource 只有 0.5 FTE"],
        secondaryDetails: [],
        deEmphasizedContent: []
      }
    ],
    accessibilityNotes: {
      minContrastRatio: 4.5,
      colorContrastNotes: ["Use WCAG AA contrast for all text/background pairs."],
      readingOrderNotes: [
        "slide_001: title, message, supporting content, controls.",
        "slide_002: title, message, supporting content, controls.",
        "slide_003: title, message, supporting content, controls."
      ],
      keyboardNavigationNotes: ["Keep previous/next keyboard navigation available."],
      manualVerificationNotes: ["Inspect dense metric cards for overlap."]
    },
    designReviewNotes: {
      styleDirectionInterpretation: [
        "ui-ux-pro-max interpreted the style direction as an operational KPI review."
      ],
      visualDensityDecision: "Use high density for KPI-heavy planning content.",
      rejectedSuggestions: [],
      htmlGenerationConstraints: [
        "HTML generation must consume DesignPlanningResult instead of reinterpreting styleDirection.",
        "Preserve slide order, title/message wording, outline meaning, and source-supported numbers.",
        "Do not render speakerNotesDraft in presentation view."
      ],
      manualVerificationNotes: ["Manually inspect visual hierarchy and consistency."]
    },
    consistencyValidation: {
      ok: true,
      checkedSlideIds: ["slide_001", "slide_002", "slide_003"],
      issues: [],
      fallbackUsed: false
    },
    ...overrides
  };
}
