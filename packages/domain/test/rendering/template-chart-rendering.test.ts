import { describe, expect, it } from "vitest";
import type { SlideDeck } from "@/deck/deck.types";
import type { DesignPlanningResult } from "@/design/types";
import { renderTemplateDeck } from "@/rendering/template-html-renderer";
import { defaultDesignStyleKit } from "@/design/default-design-style-kit";
import { defaultDesignSystem } from "@/design/default-design-system";
import { intent, pieFacts } from "./chart-rendering-fixtures";

const chartIntent = intent({ id: "chart_share", title: "收入占比", sourceFacts: pieFacts });

const deck: SlideDeck = {
  id: "deck_chart",
  title: "Chart deck",
  purpose: "demo",
  audience: "team",
  slides: [
    {
      id: "slide_1",
      slideKind: "content",
      type: "metrics",
      title: "收入占比",
      message: "各產品線占比",
      outline: [{ text: "產品A 領先", emphasis: "evidence", sourceTrace: ["chart_share"] }],
      layout: "content-summary",
      layoutIntent: { priority: "metrics_first", density: "high", emphasis: "numbers" },
      contentBlocks: [
        { kind: "bullets", content: { items: ["產品A 領先"] } },
        { kind: "chart_placeholder", content: {}, chartIntentId: "chart_share" }
      ],
      sourceTrace: ["chart_share"],
      speakerNotesDraft: ""
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

const designPlanningResult: DesignPlanningResult = {
  designSystem: defaultDesignSystem(),
  slidePatternAssignments: [],
  chartTreatmentPlans: [
    {
      chartIntentId: "chart_share",
      treatment: "chart",
      labelingNotes: [],
      preservedContext: []
    }
  ],
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
  consistencyValidation: {
    ok: true,
    checkedSlideIds: ["slide_1"],
    issues: [],
    fallbackUsed: false
  },
  styleKit: defaultDesignStyleKit()
};

describe("renderTemplateDeck chart integration", () => {
  it("renders a slide's chart_placeholder as a real chart visual, not a bullet", () => {
    const { html } = renderTemplateDeck({
      deck,
      designPlanningResult,
      chartIntents: [chartIntent]
    });
    expect(html).toContain('data-chart-visual="pie_donut"');
    expect(html).toContain('data-chart-intent-id="chart_share"');
    expect(html).toContain("<svg");
    expect(html).toContain("收入占比");
  });

  it("omits charts when no chart intents are supplied (backward compatible)", () => {
    const { html } = renderTemplateDeck({ deck, designPlanningResult });
    expect(html).not.toContain("data-chart-visual");
  });

  it("keeps the output self-contained (no external chart runtime)", () => {
    const { html } = renderTemplateDeck({
      deck,
      designPlanningResult,
      chartIntents: [chartIntent]
    });
    const start = html.indexOf('<div class="charts');
    const charts = html.slice(start, html.indexOf("</section>", start));
    expect(charts).not.toMatch(/<script|onclick=/iu);
    expect(charts).not.toMatch(/<link|url\(http/iu);
  });

  it("uses a chart-feature split and drops bullets that merely restate the chart data", () => {
    const splitDeck: SlideDeck = {
      ...deck,
      slides: [
        {
          ...deck.slides[0]!,
          outline: [
            // echoes a chart value ("45%") → dropped; the chart legend carries it
            { text: "產品A 占 45%", emphasis: "evidence", sourceTrace: ["chart_share"] },
            // an insight, not data → kept on the text side
            { text: "整體朝行動裝置移動", emphasis: "main_point", sourceTrace: ["chart_share"] }
          ]
        }
      ]
    };
    const { html } = renderTemplateDeck({
      deck: splitDeck,
      designPlanningResult,
      chartIntents: [chartIntent]
    });
    expect(html).toContain("chart-split");
    expect(html).toContain("chart-split-media");
    expect(html).toContain("整體朝行動裝置移動"); // insight kept
    expect(html).not.toContain("產品A 占 45%"); // data bullet dropped (only in the chart)
  });
});
