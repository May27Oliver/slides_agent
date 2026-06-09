import { describe, expect, it } from "vitest";
import type { RenderedChartSummary } from "@/rendering/chart-rendering.types";
import { collectChartReviewNotes } from "@/rendering/chart-renderer";
import { intent } from "./chart-rendering-fixtures";

/**
 * 009: collectChartReviewNotes is now a pure projection over the single render
 * pass's `RenderedChartSummary[]` — it does NOT re-render. These tests feed chart
 * evidence directly and assert the human-facing review-note formatting/filtering.
 */
function chart(overrides: Partial<RenderedChartSummary>): RenderedChartSummary {
  return {
    slideId: "s1",
    chartIntentId: "c1",
    visualKind: "bar",
    fallback: false,
    notes: [],
    ...overrides
  };
}

describe("collectChartReviewNotes (projection over rendered evidence)", () => {
  it("surfaces a reviewable fallback note, titled by its chart intent", () => {
    const notes = collectChartReviewNotes({
      renderedCharts: [
        chart({
          chartIntentId: "c1",
          fallback: true,
          notes: [{ code: "fallback_used", message: "資料不足以成圖，改以文字呈現。" }]
        })
      ],
      chartIntents: [intent({ id: "c1", title: "營收", sourceFacts: [] })]
    });
    expect(notes).toEqual(["「營收」：資料不足以成圖，改以文字呈現。"]);
  });

  it("omits informational series_extracted notes (not reviewable)", () => {
    const notes = collectChartReviewNotes({
      renderedCharts: [
        chart({ notes: [{ code: "series_extracted", message: "以表格呈現來源事實。" }] })
      ],
      chartIntents: [intent({ id: "c1", title: "占比", sourceFacts: [] })]
    });
    expect(notes).toEqual([]);
  });

  it("returns [] when there are no rendered charts", () => {
    expect(collectChartReviewNotes({ renderedCharts: [], chartIntents: [] })).toEqual([]);
  });

  it("falls back to the intent id when the title is unknown", () => {
    const notes = collectChartReviewNotes({
      renderedCharts: [
        chart({ chartIntentId: "cX", notes: [{ code: "unit_mismatch", message: "單位不一致。" }] })
      ],
      chartIntents: []
    });
    expect(notes).toEqual(["「cX」：單位不一致。"]);
  });
});
