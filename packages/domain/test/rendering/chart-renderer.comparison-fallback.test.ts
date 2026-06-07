import { describe, expect, it } from "vitest";
import { renderChartIntent } from "@/rendering/chart-renderer";
import { designSystem, fact, intent, styleKit } from "./chart-rendering-fixtures";

const plan = {
  chartIntentId: "c",
  treatment: "chart" as const,
  labelingNotes: [],
  preservedContext: []
};

describe("comparison fallback ordering", () => {
  it("falls back to a metric group (not a misleading bar/pie) for mixed units", () => {
    const facts = [
      fact({ value: "$2.3M", sourceText: "營收 $2.3M" }),
      fact({ value: "45%", sourceText: "成長 45%" }),
      fact({ value: "12 小時", sourceText: "回覆 12 小時" })
    ];
    const result = renderChartIntent({
      intent: intent({ id: "c", sourceFacts: facts }),
      treatmentPlan: plan,
      styleKit,
      designSystem
    });
    expect(result.visualKind).toBe("metric_group");
    expect(result.html).not.toContain("<svg");
  });

  it("falls back to a table when only one point is parseable", () => {
    const facts = [
      fact({ value: "顯著成長", sourceText: "顯著成長" }),
      fact({ value: "$2.3M", sourceText: "營收 $2.3M" })
    ];
    const result = renderChartIntent({
      intent: intent({ id: "c", sourceFacts: facts }),
      treatmentPlan: plan,
      styleKit,
      designSystem
    });
    expect(result.visualKind).toBe("table");
  });

  it("falls back to text when there are no usable facts", () => {
    const result = renderChartIntent({
      intent: intent({ id: "c", sourceFacts: [] }),
      treatmentPlan: plan,
      styleKit,
      designSystem
    });
    expect(result.visualKind).toBe("fallback_text");
  });
});
