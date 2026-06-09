// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { RenderedChartsPanel } from "@/features/slide-generation/RenderedChartsPanel";
import type { GeneratedPreviewArtifact } from "@/features/slide-generation/slide-generation.types";

type RenderedCharts = NonNullable<
  GeneratedPreviewArtifact["previewArtifact"]["generationSummary"]["renderedCharts"]
>;

afterEach(() => {
  cleanup();
});

describe("RenderedChartsPanel", () => {
  it("shows the rendered chart type and traceable slide, with no fallback badge for a real chart", () => {
    const charts: RenderedCharts = [
      { slideId: "slide_1", chartIntentId: "c1", visualKind: "bar", fallback: false, notes: [] }
    ];
    render(<RenderedChartsPanel renderedCharts={charts} />);

    expect(screen.getByText("長條圖")).toBeTruthy();
    expect(screen.getByText(/slide_1/)).toBeTruthy();
    expect(screen.queryByText("退回")).toBeNull();
  });

  it("does NOT mark a planned table as a fallback", () => {
    const charts: RenderedCharts = [
      { slideId: "slide_t", chartIntentId: "c2", visualKind: "table", fallback: false, notes: [] }
    ];
    render(<RenderedChartsPanel renderedCharts={charts} />);

    expect(screen.getByText("表格")).toBeTruthy();
    expect(screen.queryByText("退回")).toBeNull();
  });

  it("honestly marks a real fallback and surfaces its note", () => {
    const charts: RenderedCharts = [
      {
        slideId: "slide_f",
        chartIntentId: "c3",
        visualKind: "fallback_text",
        fallback: true,
        notes: [{ code: "fallback_used", message: "資料不足以成圖，改以文字呈現。" }]
      }
    ];
    render(<RenderedChartsPanel renderedCharts={charts} />);

    expect(screen.getByText("文字")).toBeTruthy();
    expect(screen.getByText("退回")).toBeTruthy();
    expect(screen.getByText("資料不足以成圖，改以文字呈現。")).toBeTruthy();
  });

  it("still flags a fallback that carries no notes (badge without a note line)", () => {
    const charts: RenderedCharts = [
      {
        slideId: "slide_n",
        chartIntentId: "c4",
        visualKind: "fallback_text",
        fallback: true,
        notes: []
      }
    ];
    const { container } = render(<RenderedChartsPanel renderedCharts={charts} />);

    expect(screen.getByText("退回")).toBeTruthy();
    // no note line is rendered when there are no notes to disclose
    expect(container.querySelector(".text-accent-600.block")).toBeNull();
  });

  it("renders an empty state when the deck has no charts", () => {
    render(<RenderedChartsPanel renderedCharts={[]} />);
    expect(screen.getByText("這份簡報沒有圖表。")).toBeTruthy();
  });
});
