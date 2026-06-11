// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { ChartEditorCard } from "@/features/deck-editor/ChartEditorCard";

afterEach(cleanup);

const baseProps = () => ({
  chartIntentId: "chart-0",
  title: "市占比較",
  selectedVisual: "auto" as const,
  sharedPages: [] as number[],
  onSetVisual: vi.fn(),
  onRemove: null
});

describe("ChartEditorCard (014 US1)", () => {
  it("shows the chart title and a visual selector defaulting to auto", () => {
    render(<ChartEditorCard {...baseProps()} />);
    expect(screen.getByText("市占比較")).toBeTruthy();
    const select = screen.getByLabelText("視覺類型") as HTMLSelectElement;
    expect(select.value).toBe("auto");
    // All six selectable visuals are offered (CR-013 用語).
    const labels = Array.from(select.options).map((option) => option.textContent);
    expect(labels).toEqual(["自動", "圓餅圖", "折線圖", "長條圖", "指標卡", "表格"]);
  });

  it("fires onSetVisual with the chosen override", () => {
    const props = baseProps();
    render(<ChartEditorCard {...props} />);
    fireEvent.change(screen.getByLabelText("視覺類型"), { target: { value: "line" } });
    expect(props.onSetVisual).toHaveBeenCalledWith("line");
  });

  it("shows the currently rendered visual and degradation notes from the preview", () => {
    render(
      <ChartEditorCard
        {...baseProps()}
        selectedVisual="line"
        renderedChart={{
          slideId: "s1",
          chartIntentId: "chart-0",
          visualKind: "bar",
          fallback: true,
          notes: [
            { code: "time_sort_failed", message: "Periods could not be reliably ordered." },
            {
              code: "fallback_used",
              message: "使用者指定的視覺類型（折線圖）資料不符，已改用其他呈現。"
            }
          ]
        }}
      />
    );
    expect(screen.getByText(/目前呈現：長條圖/)).toBeTruthy();
    expect(screen.getByText("已自動降級")).toBeTruthy();
    expect(screen.getByText(/已改用其他呈現/)).toBeTruthy();
  });

  it("shows the shared-placement hint when the intent is used on other pages", () => {
    render(<ChartEditorCard {...baseProps()} sharedPages={[3, 5]} />);
    expect(screen.getByText("此圖表也用於第 3、5 頁")).toBeTruthy();
  });

  it("hides the shared hint and notes when there are none", () => {
    render(<ChartEditorCard {...baseProps()} />);
    expect(screen.queryByText(/也用於第/)).toBeNull();
    expect(screen.queryByText("渲染註記")).toBeNull();
  });

  it("discloses user-provided data points when present (US3, FR-009)", () => {
    render(
      <ChartEditorCard {...baseProps()} disclosure={{ userPointCount: 2, totalPointCount: 5 }} />
    );
    expect(screen.getByText("本圖表含使用者提供的數據點（2/5）")).toBeTruthy();
  });
});
