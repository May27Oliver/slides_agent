import { describe, expect, it } from "vitest";
import type { Slide, SlideDeck } from "@/deck/deck.types";
import type { ChartTreatment } from "@/design/design.types";
import type { DesignPlanningResult } from "@/design/types";
import { renderTemplateDeck } from "@/rendering/template-html-renderer";
import { defaultDesignStyleKit } from "@/design/default-design-style-kit";
import { defaultDesignSystem } from "@/design/default-design-system";
import { fact, intent, pieFacts } from "./chart-rendering-fixtures";
import type { ChartIntent } from "@/content-core/chart-intent.types";

function slideWithChart(slideId: string, chartIntentId: string): Slide {
  return {
    id: slideId,
    slideKind: "content",
    type: "metrics",
    title: "圖表",
    message: "訊息",
    outline: [],
    layout: "content-summary",
    layoutIntent: { priority: "metrics_first", density: "high", emphasis: "numbers" },
    contentBlocks: [{ kind: "chart_placeholder", content: {}, chartIntentId }],
    sourceTrace: [chartIntentId],
    speakerNotesDraft: ""
  } as unknown as Slide;
}

function deckOf(slides: Slide[]): SlideDeck {
  return {
    id: "deck_x",
    title: "Deck",
    purpose: "demo",
    audience: "team",
    slides,
    reviewReport: {
      assumptions: [],
      omittedOrCompressedContent: [],
      uncertainClaims: [],
      chartingDecisions: [],
      humanReviewNotes: []
    }
  } as unknown as SlideDeck;
}

function planningWith(
  plans: Array<{ chartIntentId: string; treatment: ChartTreatment }>
): DesignPlanningResult {
  return {
    designSystem: defaultDesignSystem(),
    slidePatternAssignments: [],
    chartTreatmentPlans: plans.map((p) => ({
      chartIntentId: p.chartIntentId,
      treatment: p.treatment,
      labelingNotes: [],
      preservedContext: []
    })),
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

describe("renderTemplateDeck single-source render (renderedCharts)", () => {
  it("returns { html, renderedCharts } and draws a real pie without fallback", () => {
    const pie: ChartIntent = intent({ id: "share", title: "收入占比", sourceFacts: pieFacts });

    const result = renderTemplateDeck({
      deck: deckOf([slideWithChart("slide_1", "share")]),
      designPlanningResult: planningWith([{ chartIntentId: "share", treatment: "chart" }]),
      chartIntents: [pie]
    });

    expect(typeof result.html).toBe("string");
    expect(result.html).toContain('data-chart-visual="pie_donut"');
    expect(result.renderedCharts).toHaveLength(1);
    expect(result.renderedCharts[0]).toMatchObject({
      slideId: "slide_1",
      chartIntentId: "share",
      visualKind: "pie_donut",
      fallback: false
    });
  });

  it("marks fallback true when the renderer truly downgrades to a metric group (fallback_used)", () => {
    // Two facts with mismatched units cannot form an honest bar/pie, so the
    // comparison degrades to a metric group — that downgrade is a real fallback.
    const mismatched: ChartIntent = intent({
      id: "mix",
      title: "綜合指標",
      sourceFacts: [
        fact({ id: "h", value: "12 小時", sourceText: "處理 12 小時" }),
        fact({ id: "p", value: "45%", sourceText: "完成 45%" })
      ]
    });

    const result = renderTemplateDeck({
      deck: deckOf([slideWithChart("slide_f", "mix")]),
      designPlanningResult: planningWith([{ chartIntentId: "mix", treatment: "chart" }]),
      chartIntents: [mismatched]
    });

    const summary = result.renderedCharts[0]!;
    expect(summary.visualKind).toBe("metric_group");
    expect(summary.fallback).toBe(true);
    expect(summary.notes.some((note) => note.code === "fallback_used")).toBe(true);
  });

  it("marks fallback true when a CHART intent degrades to a table (single point)", () => {
    // A `chart` treatment with only one usable point can't draw a real chart and
    // degrades to a table — that IS a fallback even though no `fallback_used` note
    // is emitted (the regression the deep review caught).
    const onepoint: ChartIntent = intent({
      id: "one",
      title: "單點",
      sourceFacts: [fact({ id: "n", value: "$2.3M", sourceText: "北區 $2.3M" })]
    });

    const result = renderTemplateDeck({
      deck: deckOf([slideWithChart("slide_1pt", "one")]),
      designPlanningResult: planningWith([{ chartIntentId: "one", treatment: "chart" }]),
      chartIntents: [onepoint]
    });

    const summary = result.renderedCharts[0]!;
    expect(summary.visualKind).toBe("table");
    expect(summary.fallback).toBe(true);
  });

  it("does NOT mark a planned table (or table_truncated) as a fallback", () => {
    const tableIntent: ChartIntent = intent({
      id: "tbl",
      title: "區域營收",
      sourceFacts: [
        fact({ id: "a", value: "$2.3M", sourceText: "北區 $2.3M" }),
        fact({ id: "b", value: "$1.8M", sourceText: "南區 $1.8M" })
      ]
    });

    const result = renderTemplateDeck({
      deck: deckOf([slideWithChart("slide_t", "tbl")]),
      designPlanningResult: planningWith([{ chartIntentId: "tbl", treatment: "table" }]),
      chartIntents: [tableIntent]
    });

    const summary = result.renderedCharts[0]!;
    expect(summary.visualKind).toBe("table");
    expect(summary.fallback).toBe(false);
  });

  it("returns an empty renderedCharts array for a deck with no charts", () => {
    const result = renderTemplateDeck({
      deck: deckOf([
        {
          id: "plain",
          slideKind: "content",
          type: "content",
          title: "純文字",
          message: "no charts",
          outline: [{ text: "一點", emphasis: "evidence", sourceTrace: [] }],
          layout: "content-summary",
          layoutIntent: { priority: "balanced", density: "medium", emphasis: "story" },
          contentBlocks: [{ kind: "bullets", content: { items: ["一點"] } }],
          sourceTrace: [],
          speakerNotesDraft: ""
        } as unknown as Slide
      ]),
      designPlanningResult: planningWith([])
    });

    expect(result.renderedCharts).toEqual([]);
  });
});
