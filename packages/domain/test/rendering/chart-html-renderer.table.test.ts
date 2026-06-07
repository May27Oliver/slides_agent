import { describe, expect, it } from "vitest";
import { renderFactTable } from "@/rendering/chart-html-renderer";
import { renderChartIntent } from "@/rendering/chart-renderer";
import { designSystem, fact, intent, styleKit } from "./chart-rendering-fixtures";

describe("renderFactTable", () => {
  it("renders a themed table with escaped text", () => {
    const html = renderFactTable({
      rows: [
        { label: "北區", value: "$2.3M" },
        { label: "<b>南區</b>", value: "$1.8M" }
      ],
      omittedCount: 0
    });
    expect(html).toContain("<table");
    expect(html).toContain("北區");
    expect(html).toContain("&lt;b&gt;南區");
    expect(html).not.toContain("<b>南區</b>");
  });

  it("shows an omitted-rows caption when rows were truncated", () => {
    const html = renderFactTable({
      rows: [{ label: "A", value: "1" }],
      omittedCount: 4
    });
    expect(html).toContain("省略 4 列");
  });
});

describe("renderChartIntent table treatment", () => {
  const plan = {
    chartIntentId: "t",
    treatment: "table" as const,
    labelingNotes: [],
    preservedContext: []
  };

  it("renders a table and preserves source lineage", () => {
    const facts = [
      fact({ id: "r1", value: "$2.3M", sourceText: "北區 $2.3M" }),
      fact({ id: "r2", value: "$1.8M", sourceText: "南區 $1.8M" })
    ];
    const result = renderChartIntent({
      intent: intent({ id: "t", sourceFacts: facts }),
      treatmentPlan: plan,
      styleKit,
      designSystem
    });
    expect(result.visualKind).toBe("table");
    expect(result.html).toContain("<table");
    expect(result.sourceFactIds).toEqual(["r1", "r2"]);
  });

  it("truncates beyond the row limit and records a note", () => {
    const facts = Array.from({ length: 11 }, (_, index) =>
      fact({ id: `r${index}`, value: `${index}`, sourceText: `列 ${index}` })
    );
    const result = renderChartIntent({
      intent: intent({ id: "t", sourceFacts: facts }),
      treatmentPlan: plan,
      styleKit,
      designSystem
    });
    expect(result.notes.some((note) => note.code === "table_truncated")).toBe(true);
    expect(result.html).toMatch(/省略 \d+ 列/u);
  });
});
