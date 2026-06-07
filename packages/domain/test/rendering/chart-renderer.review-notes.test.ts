import { describe, expect, it } from "vitest";
import type { ContentBlock, Slide, SlideDeck } from "@/deck/deck.types";
import type { ChartTreatmentPlan } from "@/design/design.types";
import { collectChartReviewNotes } from "@/rendering/chart-renderer";
import { designSystem, fact, intent, styleKit } from "./chart-rendering-fixtures";

/** Minimal deck carrying a single chart_placeholder block (the only shape the collector reads). */
function deckWith(chartIntentId: string): SlideDeck {
  const block: ContentBlock = { kind: "chart_placeholder", content: {}, chartIntentId };
  const slide = { contentBlocks: [block] } as unknown as Slide;
  return { slides: [slide] } as unknown as SlideDeck;
}

function plan(chartIntentId: string, treatment: ChartTreatmentPlan["treatment"]): ChartTreatmentPlan {
  return { chartIntentId, treatment, labelingNotes: [], preservedContext: [] };
}

describe("collectChartReviewNotes", () => {
  it("surfaces a fallback note (titled) when a metric cannot be parsed", () => {
    const notes = collectChartReviewNotes({
      deck: deckWith("c1"),
      chartIntents: [
        intent({
          id: "c1",
          title: "營收",
          sourceFacts: [fact({ value: "顯著成長", sourceText: "顯著成長" })]
        })
      ],
      chartTreatmentPlans: [plan("c1", "metric_card")],
      styleKit,
      designSystem
    });
    expect(notes.length).toBeGreaterThan(0);
    expect(notes.some((note) => note.includes("營收"))).toBe(true);
  });

  it("discloses dropped facts even when the chart still renders", () => {
    const notes = collectChartReviewNotes({
      deck: deckWith("c2"),
      chartIntents: [
        intent({
          id: "c2",
          title: "區域營收",
          sourceFacts: [
            fact({ id: "a", value: "$2.3M", sourceText: "北區 $2.3M" }),
            fact({ id: "b", value: "$1.8M", sourceText: "南區 $1.8M" }),
            fact({ id: "c", value: "持平", sourceText: "東區 持平" })
          ]
        })
      ],
      chartTreatmentPlans: [plan("c2", "chart")],
      styleKit,
      designSystem
    });
    expect(notes.some((note) => note.includes("無法解析"))).toBe(true);
  });

  it("emits no notes for a clean chart that renders as intended", () => {
    const notes = collectChartReviewNotes({
      deck: deckWith("c3"),
      chartIntents: [
        intent({
          id: "c3",
          title: "占比",
          sourceFacts: [
            fact({ value: "45%", sourceText: "A 45%" }),
            fact({ value: "55%", sourceText: "B 55%" })
          ]
        })
      ],
      chartTreatmentPlans: [plan("c3", "chart")],
      styleKit,
      designSystem
    });
    expect(notes).toEqual([]);
  });
});
