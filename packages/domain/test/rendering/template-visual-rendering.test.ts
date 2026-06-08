import { describe, expect, it } from "vitest";
import type { ChartIntent } from "@/content-core/chart-intent.types";
import type { Slide, SlideDeck } from "@/deck/deck.types";
import type {
  ChartTreatment,
  ChartTreatmentPlan,
  DesignPlanningResult
} from "@/design/design.types";
import { renderTemplateDeck } from "@/rendering/template-html-renderer";
import { defaultDesignStyleKit } from "@/design/default-design-style-kit";
import { defaultDesignSystem } from "@/design/default-design-system";
import { fact, intent } from "./chart-rendering-fixtures";

function chartSlide(id: string, chartIntentId: string): Slide {
  return {
    id,
    slideKind: "content",
    type: "metrics",
    title: "title",
    message: "message",
    outline: [{ text: "point", emphasis: "evidence", sourceTrace: [chartIntentId] }],
    layout: "content-summary",
    layoutIntent: { priority: "metrics_first", density: "high", emphasis: "numbers" },
    contentBlocks: [
      { kind: "bullets", content: { items: ["point"] } },
      { kind: "chart_placeholder", content: {}, chartIntentId }
    ],
    sourceTrace: [chartIntentId],
    speakerNotesDraft: ""
  };
}

function planningResult(plans: ChartTreatmentPlan[]): DesignPlanningResult {
  return {
    designSystem: defaultDesignSystem(),
    slidePatternAssignments: [],
    chartTreatmentPlans: plans,
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
      visualDensityDecision: "",
      rejectedSuggestions: [],
      htmlGenerationConstraints: [],
      manualVerificationNotes: []
    },
    consistencyValidation: { ok: true, checkedSlideIds: [], issues: [], fallbackUsed: false },
    styleKit: defaultDesignStyleKit()
  };
}

function deckOf(slides: Slide[]): SlideDeck {
  return {
    id: "d",
    title: "deck",
    purpose: "p",
    audience: "a",
    slides,
    reviewReport: {
      assumptions: [],
      omittedOrCompressedContent: [],
      uncertainClaims: [],
      chartingDecisions: [],
      humanReviewNotes: []
    }
  };
}

function plan(chartIntentId: string, treatment: ChartTreatment): ChartTreatmentPlan {
  return { chartIntentId, treatment, labelingNotes: [], preservedContext: [] };
}

describe("renderTemplateDeck non-chart visuals", () => {
  it("renders a repeated metric card with a consistent shared class across slides", () => {
    const metricIntent: ChartIntent = intent({
      id: "rev",
      title: "營收",
      sourceFacts: [fact({ id: "f_rev", value: "$2.3M", sourceText: "營收 $2.3M" })]
    });
    const { html } = renderTemplateDeck({
      deck: deckOf([chartSlide("s1", "rev"), chartSlide("s2", "rev")]),
      designPlanningResult: planningResult([plan("rev", "metric_card")]),
      chartIntents: [metricIntent]
    });
    expect((html.match(/data-chart-visual="metric_card"/gu) ?? []).length).toBe(2);
    // both slides show the same metric value via the shared engine (not drifting).
    expect((html.match(/\$2\.3M/gu) ?? []).length).toBe(2);
  });

  it("renders a table treatment as an HTML table in the slide body", () => {
    const tableIntent: ChartIntent = intent({
      id: "tbl",
      title: "明細",
      sourceFacts: [
        fact({ id: "a", value: "$2.3M", sourceText: "北區 $2.3M" }),
        fact({ id: "b", value: "$1.8M", sourceText: "南區 $1.8M" })
      ]
    });
    const { html } = renderTemplateDeck({
      deck: deckOf([chartSlide("s1", "tbl")]),
      designPlanningResult: planningResult([plan("tbl", "table")]),
      chartIntents: [tableIntent]
    });
    expect(html).toContain('data-chart-visual="table"');
    expect(html).toContain("<table");
  });
});
