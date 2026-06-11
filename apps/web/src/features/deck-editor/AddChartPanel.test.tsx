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
    render(<AddChartPanel intents={intents} usedPagesByIntent={{}} onAddExisting={vi.fn()} />);
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

  // US4: manual-input tab.
  describe("manual input tab", () => {
    const openManualTab = () => fireEvent.click(screen.getByRole("tab", { name: "手動輸入" }));

    it("offers title + visual + point rows behind the manual tab", () => {
      render(
        <AddChartPanel
          intents={intents}
          usedPagesByIntent={{}}
          onAddExisting={vi.fn()}
          onAddUserData={vi.fn()}
        />
      );
      openManualTab();
      expect(screen.getByLabelText("圖表標題")).toBeTruthy();
      expect(screen.getByLabelText("視覺類型")).toBeTruthy();
      expect(screen.getByLabelText("標籤")).toBeTruthy();
    });

    it("disables create until the title and at least one valid point exist", () => {
      render(
        <AddChartPanel
          intents={[]}
          usedPagesByIntent={{}}
          onAddExisting={vi.fn()}
          onAddUserData={vi.fn()}
        />
      );
      openManualTab();
      const create = screen.getByText("建立圖表") as HTMLButtonElement;
      expect(create.disabled).toBe(true);

      fireEvent.change(screen.getByLabelText("圖表標題"), { target: { value: "手動圖" } });
      fireEvent.change(screen.getByLabelText("標籤"), { target: { value: "A" } });
      fireEvent.change(screen.getByLabelText("數值"), { target: { value: "abc" } });
      expect((screen.getByText("建立圖表") as HTMLButtonElement).disabled).toBe(true);

      fireEvent.change(screen.getByLabelText("數值"), { target: { value: "42" } });
      expect((screen.getByText("建立圖表") as HTMLButtonElement).disabled).toBe(false);
    });

    it("creates the chart with the entered title/visual/points", () => {
      const onAddUserData = vi.fn();
      render(
        <AddChartPanel
          intents={[]}
          usedPagesByIntent={{}}
          onAddExisting={vi.fn()}
          onAddUserData={onAddUserData}
        />
      );
      openManualTab();
      fireEvent.change(screen.getByLabelText("圖表標題"), { target: { value: "手動圖" } });
      fireEvent.change(screen.getByLabelText("視覺類型"), { target: { value: "bar" } });
      fireEvent.change(screen.getByLabelText("標籤"), { target: { value: "A" } });
      fireEvent.change(screen.getByLabelText("數值"), { target: { value: "42" } });
      fireEvent.change(screen.getByLabelText("單位"), { target: { value: "%" } });
      fireEvent.click(screen.getByText(/新增數據點/));
      const labels = screen.getAllByLabelText("標籤");
      fireEvent.change(labels[1]!, { target: { value: "B" } });
      const values = screen.getAllByLabelText("數值");
      fireEvent.change(values[1]!, { target: { value: "58" } });
      fireEvent.click(screen.getByText("建立圖表"));

      expect(onAddUserData).toHaveBeenCalledWith({
        title: "手動圖",
        visual: "bar",
        points: [
          { label: "A", valueText: "42", unit: "%" },
          { label: "B", valueText: "58", unit: null }
        ]
      });
    });
  });
});
