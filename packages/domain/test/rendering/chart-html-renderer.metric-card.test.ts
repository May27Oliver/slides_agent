import { describe, expect, it } from "vitest";
import { renderChartIntent } from "@/rendering/chart-renderer";
import { renderMetricCard } from "@/rendering/chart-html-renderer";
import type { ChartPoint } from "@/rendering/chart-rendering.types";
import { designSystem, fact, intent, styleKit } from "./chart-rendering-fixtures";

const point: ChartPoint = {
  label: "營收 (↑18% YoY)",
  displayValue: "$2.3M",
  value: 2.3,
  unit: "$M",
  sourceFactId: "f_rev",
  sourceText: "營收 $2.3M (↑18% YoY)"
};

describe("renderMetricCard", () => {
  it("renders the big number, context, and theme accent", () => {
    const html = renderMetricCard({ point, hue: styleKit.accentHues[0]! });
    expect(html).toContain("$2.3M");
    expect(html).toContain("營收 (↑18% YoY)");
    expect(html).toContain("--chart-accent:");
  });

  it("escapes malicious context", () => {
    const html = renderMetricCard({
      point: { ...point, label: "<script>x</script>" }
    });
    expect(html).not.toContain("<script>");
  });
});

describe("renderChartIntent metric_card treatment", () => {
  const plan = {
    chartIntentId: "m",
    treatment: "metric_card" as const,
    labelingNotes: [],
    preservedContext: []
  };

  it("renders a metric card from a parseable metric fact with lineage", () => {
    const result = renderChartIntent({
      intent: intent({
        id: "m",
        sourceFacts: [fact({ id: "f_rev", value: "$2.3M", sourceText: "營收 $2.3M" })]
      }),
      treatmentPlan: plan,
      styleKit,
      designSystem
    });
    expect(result.visualKind).toBe("metric_card");
    expect(result.html).toContain("$2.3M");
    expect(result.sourceFactIds).toEqual(["f_rev"]);
  });

  it("falls back to text and notes when the metric cannot be parsed", () => {
    const result = renderChartIntent({
      intent: intent({
        id: "m",
        sourceFacts: [fact({ value: "顯著成長", sourceText: "顯著成長" })]
      }),
      treatmentPlan: plan,
      styleKit,
      designSystem
    });
    expect(result.visualKind).toBe("fallback_text");
    expect(result.notes.some((note) => note.code === "fallback_used")).toBe(true);
  });
});
