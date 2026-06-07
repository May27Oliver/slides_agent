import { describe, expect, it } from "vitest";
import { extractChartSeries } from "@/rendering/chart-series-extractor";
import { renderBarChart, renderLineChart, renderPieChart } from "@/rendering/chart-svg-renderer";
import { barFacts, intent, pieFacts, styleKit, timeFacts } from "./chart-rendering-fixtures";

const hues = styleKit.accentHues;

function seriesFor(facts: typeof barFacts, treatment: "chart" | "timeline") {
  return extractChartSeries({ intent: intent({ sourceFacts: facts }), treatment });
}

describe("chart SVG renderers", () => {
  it("renders a bar chart with one rect per point and value labels", () => {
    const svg = renderBarChart({ series: seriesFor(barFacts, "chart"), hues });
    expect(svg).toContain("<svg");
    expect((svg.match(/<rect/gu) ?? []).length).toBe(4);
    expect(svg).toContain("$2.3M");
    expect(svg).toContain("<title>");
  });

  it("renders a line chart with a polyline and a dot per point", () => {
    const svg = renderLineChart({ series: seriesFor(timeFacts, "timeline"), hues });
    expect(svg).toContain("<polyline");
    expect((svg.match(/<circle/gu) ?? []).length).toBe(4);
  });

  it("renders a donut as one stroke arc per point plus a legend", () => {
    const html = renderPieChart({ series: seriesFor(pieFacts, "chart"), hues });
    expect((html.match(/class="chart-pie-slice"/gu) ?? []).length).toBe(3);
    expect(html).not.toMatch(/<path/u); // stroke-arc model, no filled wedges
    expect(html).toContain("chart-legend");
    expect(html).toContain("45%");
  });

  it("does not repeat the percentage in the legend (45%, not '45% · 45.0%')", () => {
    const html = renderPieChart({ series: seriesFor(pieFacts, "chart"), hues });
    // The display value is already a percentage, so the recomputed share is redundant.
    expect(html).toContain("45%");
    expect(html).not.toMatch(/·\s*\d+\.\d+%/u);
  });

  it("still shows the proportion in the legend for non-percentage values", () => {
    const html = renderPieChart({ series: seriesFor(barFacts, "chart"), hues });
    // $2.3M carries no percentage, so the legend appends the computed share.
    expect(html).toContain("$2.3M");
    expect(html).toMatch(/·\s*\d+\.\d+%/u);
  });

  it("draws a single 100% slice as a full ring (no degenerate blank arc)", () => {
    const oneSlice = intent({
      sourceFacts: [
        { id: "s1", kind: "metric", value: "100%", sourceText: "產品A 占 100%" },
        { id: "s2", kind: "metric", value: "0%", sourceText: "產品B 占 0%" }
      ]
    });
    const html = renderPieChart({
      series: extractChartSeries({ intent: oneSlice, treatment: "chart" }),
      hues
    });
    // The 100% slice spans the whole normalised path (dasharray "1 1") — a clean
    // full ring, not a 360° arc that would collapse to invisible.
    expect(html).toContain('stroke-dasharray="1 1"');
    expect(html).not.toMatch(/<path/u);
  });

  it("draws negative bars with real height off a zero baseline (no clamped 0)", () => {
    const mixedSign = intent({
      sourceFacts: [
        { id: "b_pos", kind: "metric", value: "10", sourceText: "毛利 10" },
        { id: "b_neg", kind: "metric", value: "-5", sourceText: "淨損 -5" }
      ]
    });
    const svg = renderBarChart({
      series: extractChartSeries({ intent: mixedSign, treatment: "chart" }),
      hues
    });
    expect((svg.match(/<rect/gu) ?? []).length).toBe(2);
    expect(svg).toContain("-5");
    // The negative bar must have non-zero height (the old clamp produced 0.00).
    expect(svg).not.toContain('height="0.00"');
  });

  it("carries CSS entrance-animation hooks (pathLength / bar class / slice vars)", () => {
    const line = renderLineChart({ series: seriesFor(timeFacts, "timeline"), hues });
    expect(line).toContain('pathLength="1"');
    const bar = renderBarChart({ series: seriesFor(barFacts, "chart"), hues });
    expect(bar).toContain('class="chart-bar"');
    const pie = renderPieChart({ series: seriesFor(pieFacts, "chart"), hues });
    expect(pie).toMatch(/--frac:/u);
    expect(pie).toMatch(/--slice-start:/u);
  });

  it("emits no external resources or event handlers", () => {
    const svg = renderBarChart({ series: seriesFor(barFacts, "chart"), hues });
    expect(svg).not.toMatch(/<script|href=|url\(|onclick=/iu);
  });

  it("sanitizes malicious labels so they cannot break out of the svg", () => {
    const evil = intent({
      sourceFacts: [
        { id: "x1", kind: "metric", value: "10", sourceText: "</text><script>alert(1)</script>" },
        { id: "x2", kind: "metric", value: "20", sourceText: "safe" }
      ]
    });
    const svg = renderBarChart({
      series: extractChartSeries({ intent: evil, treatment: "chart" }),
      hues
    });
    expect(svg).not.toContain("<script>");
    expect(svg).toContain("&lt;");
  });
});
