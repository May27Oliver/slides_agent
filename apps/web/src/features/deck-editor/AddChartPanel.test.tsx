// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ChartIntent } from "@slides-agent/domain";
import { AddChartPanel } from "@/features/deck-editor/AddChartPanel";

afterEach(cleanup);

const intents: ChartIntent[] = [
  {
    id: "chart-0",
    title: "市占比較",
    sourceFacts: [
      { id: "f1", kind: "metric", value: "45%", sourceText: "產品A 占 45%" },
      { id: "f2", kind: "metric", value: "55%", sourceText: "產品B 占 55%" }
    ],
    recommendedVisuals: ["comparison"],
    rationale: "顯示市占結構"
  },
  {
    id: "chart-1",
    title: "季度營收",
    sourceFacts: [{ id: "f3", kind: "metric", value: "$1.0M", sourceText: "Q1 營收 $1.0M" }],
    recommendedVisuals: ["timeline"],
    rationale: "顯示營收趨勢"
  }
];

describe("AddChartPanel (014 US2)", () => {
  it("lists ALL intents with title, rationale and a source-fact preview", () => {
    render(
      <AddChartPanel intents={intents} usedPagesByIntent={{}} onAddExisting={vi.fn()} />
    );
    expect(screen.getByText("市占比較")).toBeTruthy();
    expect(screen.getByText("季度營收")).toBeTruthy();
    expect(screen.getByText("顯示市占結構")).toBeTruthy();
    expect(screen.getByText(/45%/)).toBeTruthy();
  });

  it("marks intents already placed with the page numbers (still selectable)", () => {
    const onAddExisting = vi.fn();
    render(
      <AddChartPanel
        intents={intents}
        usedPagesByIntent={{ "chart-0": [2] }}
        onAddExisting={onAddExisting}
      />
    );
    expect(screen.getByText("已用於第 2 頁")).toBeTruthy();
    // A used intent can still be placed here (shared placement, US2 場景 5).
    const buttons = screen.getAllByText("加入此頁");
    expect(buttons).toHaveLength(2);
    fireEvent.click(buttons[0]!);
    expect(onAddExisting).toHaveBeenCalledWith("chart-0");
  });

  it("shows the empty state when the deck has no chart intents", () => {
    render(<AddChartPanel intents={[]} usedPagesByIntent={{}} onAddExisting={vi.fn()} />);
    expect(screen.getByText("此簡報沒有可用的來源圖表。")).toBeTruthy();
  });
});
