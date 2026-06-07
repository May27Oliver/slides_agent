import { describe, expect, it } from "vitest";
import type { SourceFact } from "@/deck/deck.types";
import type { ChartTreatment } from "@/design/design.types";
import { renderChartIntent } from "@/rendering/chart-renderer";
import {
  barFacts,
  designSystem,
  fact,
  intent,
  pieFacts,
  styleKit,
  timeFacts
} from "./chart-rendering-fixtures";

function render(facts: SourceFact[], treatment: ChartTreatment) {
  return renderChartIntent({
    intent: intent({ id: "chart_demo", sourceFacts: facts }),
    treatmentPlan: {
      chartIntentId: "chart_demo",
      treatment,
      labelingNotes: [],
      preservedContext: []
    },
    styleKit,
    designSystem
  });
}

describe("renderChartIntent", () => {
  it("renders a percentage comparison as a pie/donut with lineage attributes", () => {
    const result = render(pieFacts, "chart");
    expect(result.visualKind).toBe("pie_donut");
    expect(result.html).toContain('data-chart-visual="pie_donut"');
    expect(result.html).toContain('data-chart-intent-id="chart_demo"');
    expect(result.html).toContain("data-source-fact-ids=");
  });

  it("renders a same-unit currency comparison as a bar chart", () => {
    expect(render(barFacts, "chart").visualKind).toBe("bar");
  });

  it("renders a sortable timeline as a line chart", () => {
    expect(render(timeFacts, "timeline").visualKind).toBe("line");
  });

  it("falls back to a metric group for mixed-unit comparison and records a note", () => {
    const mixed = [
      fact({ value: "$2.3M", sourceText: "營收 $2.3M" }),
      fact({ value: "45%", sourceText: "成長 45%" }),
      fact({ value: "12 小時", sourceText: "回覆 12 小時" })
    ];
    const result = render(mixed, "chart");
    expect(result.visualKind).toBe("metric_group");
    expect(result.notes.some((note) => note.code === "fallback_used")).toBe(true);
    expect(result.notes.every((note) => note.chartIntentId === "chart_demo")).toBe(true);
  });

  it("uses the VisualizationType mapping when no treatment plan is given", () => {
    const result = renderChartIntent({
      intent: intent({ id: "c", sourceFacts: pieFacts, recommendedVisuals: ["comparison"] }),
      styleKit,
      designSystem
    });
    expect(result.visualKind).toBe("pie_donut");
  });

  it("keeps malicious source strings sanitized in the output", () => {
    const evil = intent({
      id: "evil",
      sourceFacts: [
        fact({ value: "10", sourceText: "<script>alert(1)</script>" }),
        fact({ value: "20", sourceText: "ok" })
      ]
    });
    const result = renderChartIntent({
      intent: evil,
      treatmentPlan: {
        chartIntentId: "evil",
        treatment: "chart",
        labelingNotes: [],
        preservedContext: []
      },
      styleKit,
      designSystem
    });
    expect(result.html).not.toContain("<script>");
  });
});
