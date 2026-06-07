import { describe, expect, it } from "vitest";
import type { VisualizationType } from "@/content-core/chart-intent.types";
import type { ChartTreatment } from "@/design/design.types";
import {
  MAPPED_VISUALIZATION_TYPES,
  mapVisualizationTypeToTreatment,
  resolveTreatmentForVisuals
} from "@/design/chart-treatment-mapping";

const ALL_TYPES: VisualizationType[] = [
  "metric_card",
  "comparison",
  "timeline",
  "milestone",
  "callout",
  "table",
  "none"
];

const EXPECTED: Record<VisualizationType, ChartTreatment> = {
  metric_card: "metric_card",
  comparison: "chart",
  timeline: "timeline",
  milestone: "metric_card",
  callout: "metric_card",
  table: "table",
  none: "fallback_text"
};

describe("VisualizationType → ChartTreatment mapping", () => {
  it("covers every VisualizationType exactly once", () => {
    expect([...MAPPED_VISUALIZATION_TYPES].sort()).toEqual([...ALL_TYPES].sort());
  });

  it.each(ALL_TYPES)("maps %s to its single treatment", (type) => {
    expect(mapVisualizationTypeToTreatment(type)).toBe(EXPECTED[type]);
  });

  it("resolves the first recommended visual", () => {
    expect(resolveTreatmentForVisuals(["timeline", "comparison"])).toBe("timeline");
  });

  it("falls back to fallback_text for an empty recommendation list", () => {
    expect(resolveTreatmentForVisuals([])).toBe("fallback_text");
  });
});
