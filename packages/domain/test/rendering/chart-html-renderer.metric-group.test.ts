import { describe, expect, it } from "vitest";
import { renderMetricGroup } from "@/rendering/chart-html-renderer";
import type { ChartPoint } from "@/rendering/chart-rendering.types";
import { styleKit } from "./chart-rendering-fixtures";

function point(partial: Partial<ChartPoint> & { displayValue: string; sourceFactId: string }): ChartPoint {
  return {
    label: partial.label ?? "label",
    displayValue: partial.displayValue,
    value: partial.value ?? 0,
    unit: partial.unit ?? null,
    sourceFactId: partial.sourceFactId,
    sourceText: partial.sourceText ?? "text"
  };
}

describe("renderMetricGroup", () => {
  it("renders one metric tile per point", () => {
    const html = renderMetricGroup({
      points: [
        point({ displayValue: "$2.3M", label: "營收", sourceFactId: "f1" }),
        point({ displayValue: "45%", label: "成長", sourceFactId: "f2" }),
        point({ displayValue: "12 小時", label: "回覆", sourceFactId: "f3" })
      ],
      hues: styleKit.accentHues
    });
    expect((html.match(/chart-metric-value/gu) ?? []).length).toBe(3);
    expect(html).toContain("$2.3M");
    expect(html).toContain("12 小時");
  });

  it("sanitizes labels", () => {
    const html = renderMetricGroup({
      points: [point({ displayValue: "1", label: "<i>x</i>", sourceFactId: "f1" })],
      hues: styleKit.accentHues
    });
    expect(html).not.toContain("<i>x</i>");
  });
});
