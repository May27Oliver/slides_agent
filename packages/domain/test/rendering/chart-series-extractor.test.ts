import { describe, expect, it } from "vitest";
import { extractChartSeries } from "@/rendering/chart-series-extractor";
import { barFacts, fact, intent, pieFacts, timeFacts } from "./chart-rendering-fixtures";

describe("extractChartSeries", () => {
  it("extracts a categorical series with source-fact lineage", () => {
    const series = extractChartSeries({
      intent: intent({ sourceFacts: barFacts }),
      treatment: "chart"
    });
    expect(series.kind).toBe("categorical");
    expect(series.points).toHaveLength(4);
    expect(series.points[0]!.sourceFactId).toBe("f_north");
    expect(series.points[0]!.displayValue).toBe("$2.3M");
    expect(series.sourceFactIds).toEqual(["f_north", "f_south", "f_east", "f_west"]);
    expect(series.unit).toBe("$M");
  });

  it("orders a time series by detected period for the timeline treatment", () => {
    const shuffled = [timeFacts[2]!, timeFacts[0]!, timeFacts[3]!, timeFacts[1]!];
    const series = extractChartSeries({
      intent: intent({ sourceFacts: shuffled }),
      treatment: "timeline"
    });
    expect(series.kind).toBe("time");
    expect(series.points.map((point) => point.sourceFactId)).toEqual([
      "t_q1",
      "t_q2",
      "t_q3",
      "t_q4"
    ]);
  });

  it("flags a unit mismatch and nulls the shared unit", () => {
    const mixed = [
      fact({ value: "$2.3M", sourceText: "營收 $2.3M" }),
      fact({ value: "45%", sourceText: "成長 45%" })
    ];
    const series = extractChartSeries({
      intent: intent({ sourceFacts: mixed }),
      treatment: "chart"
    });
    expect(series.unit).toBeNull();
    expect(series.warnings.some((note) => note.code === "unit_mismatch")).toBe(true);
  });

  it("drops unparseable facts and warns when too few points remain", () => {
    const facts = [
      fact({ value: "顯著成長", sourceText: "顯著成長" }),
      fact({ value: "$2.3M", sourceText: "營收 $2.3M" })
    ];
    const series = extractChartSeries({
      intent: intent({ sourceFacts: facts }),
      treatment: "chart"
    });
    expect(series.points).toHaveLength(1);
    expect(series.warnings.some((note) => note.code === "series_insufficient")).toBe(true);
  });

  it("does not flag a single metric-card point as series-insufficient", () => {
    const series = extractChartSeries({
      intent: intent({
        sourceFacts: [fact({ value: "$2.3M", sourceText: "年度營收 $2.3M" })]
      }),
      treatment: "metric_card"
    });
    expect(series.points).toHaveLength(1);
    expect(series.warnings.some((note) => note.code === "series_insufficient")).toBe(false);
  });

  it("refuses to order a timeline that mixes bare quarters with dated periods", () => {
    const mixedGranularity = [
      fact({ value: "$1.0M", sourceText: "Q2 營收 $1.0M" }),
      fact({ value: "$1.4M", sourceText: "2026 Q1 營收 $1.4M" })
    ];
    const series = extractChartSeries({
      intent: intent({ sourceFacts: mixedGranularity }),
      treatment: "timeline"
    });
    expect(series.kind).toBe("categorical");
    expect(series.warnings.some((note) => note.code === "time_sort_failed")).toBe(true);
  });

  it("discloses dropped unparseable facts even when enough points remain to chart", () => {
    const facts = [
      fact({ id: "k1", value: "$2.3M", sourceText: "北區 $2.3M" }),
      fact({ id: "k2", value: "$1.8M", sourceText: "南區 $1.8M" }),
      fact({ id: "drop", value: "顯著成長", sourceText: "東區 顯著成長" })
    ];
    const series = extractChartSeries({
      intent: intent({ sourceFacts: facts }),
      treatment: "chart"
    });
    expect(series.points).toHaveLength(2);
    const uncertain = series.warnings.find((note) => note.code === "value_parse_uncertain");
    expect(uncertain).toBeDefined();
    expect(uncertain!.sourceFactIds).toEqual(["drop"]);
    // The chart still renders (2 points), so it must NOT also claim it was insufficient.
    expect(series.warnings.some((note) => note.code === "series_insufficient")).toBe(false);
  });

  it("derives clean category / period labels from full sentences (not fragments)", () => {
    const categorical = extractChartSeries({
      intent: intent({
        sourceFacts: [
          fact({ value: "52%", sourceText: "行動裝置占使用者工作階段的 52%。" }),
          fact({ value: "33%", sourceText: "桌機：33%" })
        ]
      }),
      treatment: "chart"
    });
    expect(categorical.points.map((point) => point.label)).toEqual(["行動裝置", "桌機"]);

    const timeline = extractChartSeries({
      intent: intent({
        sourceFacts: [
          fact({ value: "$1.0M", sourceText: "Q1 2026 新增訂單金額為 $1.0M" }),
          fact({ value: "$1.4M", sourceText: "Q2 2026 新增訂單金額為 $1.4M" })
        ]
      }),
      treatment: "timeline"
    });
    expect(timeline.points.map((point) => point.label)).toEqual(["Q1 2026", "Q2 2026"]);
  });

  it("warns when a timeline cannot be reliably ordered", () => {
    const series = extractChartSeries({
      intent: intent({ sourceFacts: pieFacts }),
      treatment: "timeline"
    });
    expect(series.kind).toBe("categorical");
    expect(series.warnings.some((note) => note.code === "time_sort_failed")).toBe(true);
  });
});

describe("extractChartSeries — SourceFact.metric short-circuit (014)", () => {
  it("builds the point directly from metric, bypassing value/sourceText parsing", () => {
    const userFact = fact({
      id: "fact_user_r3_0_0",
      kind: "user_provided",
      value: "45%",
      sourceText: "使用者於編輯器輸入",
      metric: { label: "行動裝置", displayValue: "45%", numericValue: 45, unit: "%" }
    });
    const series = extractChartSeries({
      intent: intent({ sourceFacts: [userFact] }),
      treatment: "metric_card"
    });
    expect(series.points).toHaveLength(1);
    // Label comes from metric.label — NOT derived from "使用者於編輯器輸入".
    expect(series.points[0]).toEqual({
      label: "行動裝置",
      displayValue: "45%",
      value: 45,
      unit: "%",
      sourceFactId: "fact_user_r3_0_0",
      sourceText: "使用者於編輯器輸入"
    });
  });

  it("keeps a metric fact whose displayValue the free-text parser cannot parse", () => {
    const odd = fact({
      id: "u_odd",
      kind: "user_provided",
      value: "顯著成長",
      sourceText: "使用者於編輯器輸入",
      metric: { label: "東區", displayValue: "顯著成長", numericValue: 42, unit: null }
    });
    const series = extractChartSeries({
      intent: intent({ sourceFacts: [odd] }),
      treatment: "metric_card"
    });
    expect(series.points).toHaveLength(1);
    expect(series.points[0]!.value).toBe(42);
    expect(series.points[0]!.displayValue).toBe("顯著成長");
    expect(series.warnings.some((note) => note.code === "value_parse_uncertain")).toBe(false);
  });

  it("derives the time sort key from metric.label so user points order on a timeline", () => {
    const q2 = fact({
      id: "u_q2",
      kind: "user_provided",
      value: "$1.4M",
      sourceText: "使用者於編輯器輸入",
      metric: { label: "Q2 2026", displayValue: "$1.4M", numericValue: 1.4, unit: "$M" }
    });
    const q1 = fact({
      id: "u_q1",
      kind: "user_provided",
      value: "$1.0M",
      sourceText: "使用者於編輯器輸入",
      metric: { label: "Q1 2026", displayValue: "$1.0M", numericValue: 1.0, unit: "$M" }
    });
    const series = extractChartSeries({
      intent: intent({ sourceFacts: [q2, q1] }),
      treatment: "timeline"
    });
    expect(series.kind).toBe("time");
    expect(series.points.map((point) => point.sourceFactId)).toEqual(["u_q1", "u_q2"]);
  });

  it("mixes metric and plain facts: units shared, plain facts still parsed as before", () => {
    const userPoint = fact({
      id: "u_mix",
      kind: "user_provided",
      value: "$1.1M",
      sourceText: "使用者於編輯器輸入",
      metric: { label: "中區", displayValue: "$1.1M", numericValue: 1.1, unit: "$M" }
    });
    const series = extractChartSeries({
      intent: intent({ sourceFacts: [...barFacts, userPoint] }),
      treatment: "chart"
    });
    expect(series.points).toHaveLength(5);
    expect(series.unit).toBe("$M");
    expect(series.sourceFactIds).toEqual(["f_north", "f_south", "f_east", "f_west", "u_mix"]);
  });

  it("regression: a fact WITHOUT metric keeps the exact current parse-derived point shape", () => {
    const series = extractChartSeries({
      intent: intent({ sourceFacts: barFacts }),
      treatment: "chart"
    });
    expect(series.points[0]).toEqual({
      label: "北區營收",
      displayValue: "$2.3M",
      value: 2.3,
      unit: "$M",
      sourceFactId: "f_north",
      sourceText: "北區營收 $2.3M"
    });
  });
});
