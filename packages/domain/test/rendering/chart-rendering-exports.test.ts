import { describe, expect, it } from "vitest";
import * as domain from "@/index";

describe("chart rendering public API", () => {
  it("exports the chart rendering and mapping functions", () => {
    expect(typeof domain.parseMetricValue).toBe("function");
    expect(typeof domain.extractChartSeries).toBe("function");
    expect(typeof domain.validatePieSeries).toBe("function");
    expect(typeof domain.validateLineSeries).toBe("function");
    expect(typeof domain.validateBarSeries).toBe("function");
    expect(typeof domain.renderPieChart).toBe("function");
    expect(typeof domain.renderLineChart).toBe("function");
    expect(typeof domain.renderBarChart).toBe("function");
    expect(typeof domain.renderMetricCard).toBe("function");
    expect(typeof domain.renderMetricGroup).toBe("function");
    expect(typeof domain.renderFactTable).toBe("function");
    expect(typeof domain.renderFallbackText).toBe("function");
    expect(typeof domain.renderChartIntent).toBe("function");
    expect(typeof domain.mapVisualizationTypeToTreatment).toBe("function");
  });
});
