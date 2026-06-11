import { describe, expect, it } from "vitest";
import type { SourceFact } from "@/deck/deck.types";
import type { ChartTreatment, ChartVisualOverride } from "@/design/design.types";
import { renderChartIntent } from "@/rendering/chart-renderer";
import { barFacts, designSystem, fact, intent, pieFacts, styleKit, timeFacts } from "./chart-rendering-fixtures";

function render(facts: SourceFact[], treatment: ChartTreatment, visualOverride?: ChartVisualOverride) {
  return renderChartIntent({
    intent: intent({ id: "chart_demo", sourceFacts: facts }),
    treatmentPlan: {
      chartIntentId: "chart_demo",
      treatment,
      ...(visualOverride ? { visualOverride } : {}),
      labelingNotes: [],
      preservedContext: []
    },
    styleKit,
    designSystem
  });
}

describe("renderChartIntent — visualOverride (014)", () => {
  it("pie_donut override draws a pie when the series is a part-to-whole percentage", () => {
    const result = render(pieFacts, "chart", "pie_donut");
    expect(result.visualKind).toBe("pie_donut");
    expect(result.fallback).toBe(false);
  });

  it("pie_donut override on a non-part-to-whole series degrades to bar with a note", () => {
    const result = render(barFacts, "chart", "pie_donut");
    expect(result.visualKind).toBe("bar");
    expect(result.fallback).toBe(true);
    expect(result.notes.some((note) => note.code === "fallback_used")).toBe(true);
  });

  it("line override works even when the intent's treatment is comparison", () => {
    const result = render(timeFacts, "chart", "line");
    expect(result.visualKind).toBe("line");
    expect(result.fallback).toBe(false);
  });

  it("line override without a reliable time order degrades and flags fallback", () => {
    const result = render(pieFacts, "chart", "line");
    expect(result.visualKind).toBe("bar");
    expect(result.fallback).toBe(true);
    expect(result.notes.some((note) => note.code === "time_sort_failed")).toBe(true);
    expect(result.notes.some((note) => note.code === "fallback_used")).toBe(true);
  });

  it("bar override draws a bar for a valid same-unit series", () => {
    const result = render(barFacts, "timeline", "bar");
    expect(result.visualKind).toBe("bar");
    expect(result.fallback).toBe(false);
  });

  it("bar override with a single point degrades through the existing chain", () => {
    const result = render([fact({ value: "$2.3M", sourceText: "營收 $2.3M" })], "chart", "bar");
    expect(result.visualKind).toBe("table");
    expect(result.fallback).toBe(true);
    expect(result.notes.some((note) => note.code === "fallback_used")).toBe(true);
  });

  it("metric_card override renders the first point as a metric card (planned, not fallback)", () => {
    const result = render(barFacts, "chart", "metric_card");
    expect(result.visualKind).toBe("metric_card");
    expect(result.fallback).toBe(false);
  });

  it("table override renders the source-fact table (planned, not fallback)", () => {
    const result = render(barFacts, "chart", "table");
    expect(result.visualKind).toBe("table");
    expect(result.fallback).toBe(false);
  });

  it("auto override is byte-for-byte identical to the current automatic selection", () => {
    for (const [facts, treatment] of [
      [pieFacts, "chart"],
      [barFacts, "chart"],
      [timeFacts, "timeline"]
    ] as const) {
      const auto = render(facts, treatment, "auto");
      const none = render(facts, treatment);
      expect(auto).toEqual(none);
      expect(auto.html).toBe(none.html);
    }
  });

  it("a missing override keeps the existing degrade chain untouched (regression)", () => {
    const mixed = [
      fact({ value: "$2.3M", sourceText: "營收 $2.3M" }),
      fact({ value: "45%", sourceText: "成長 45%" }),
      fact({ value: "12 小時", sourceText: "回覆 12 小時" })
    ];
    const result = render(mixed, "chart");
    expect(result.visualKind).toBe("metric_group");
    expect(result.fallback).toBe(true);
  });
});
