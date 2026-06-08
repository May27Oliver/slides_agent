// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ChartPresetPreview } from "@/features/slide-generation/ChartPresetPreview";
import { chartPresets } from "@/features/slide-generation/chart-presets";

afterEach(() => {
  cleanup();
});

describe("ChartPresetPreview", () => {
  it("renders the four chart presets as an accessible single-select radio group", () => {
    render(
      <fieldset>
        <legend>圖表預設</legend>
        <ChartPresetPreview
          presets={chartPresets}
          selectedKey="preset.chart.none"
          onSelect={vi.fn()}
        />
      </fieldset>
    );

    const group = screen.getByRole("group", { name: "圖表預設" });

    expect(within(group).getAllByRole("radio")).toHaveLength(4);
    expect(within(group).getByRole("radio", { name: /比較/ })).toBeTruthy();
  });

  it("previews the representative visual kinds for each preset without promising a chart", () => {
    render(
      <ChartPresetPreview
        presets={chartPresets}
        selectedKey="preset.chart.none"
        onSelect={vi.fn()}
      />
    );

    // comparison → bar + pie_donut；trend → line；metric → metric_card
    expect(screen.getByText("長條圖")).toBeTruthy();
    expect(screen.getByText("圓餅圖")).toBeTruthy();
    expect(screen.getByText("折線圖")).toBeTruthy();
    expect(screen.getByText("指標卡")).toBeTruthy();
    // honest copy: the preset only nudges a tendency, it never claims a chart will appear
    expect(screen.getByText(/交由內容決定/)).toBeTruthy();
  });

  it("calls onSelect with the preset key (selection survives a language switch)", () => {
    const onSelect = vi.fn();

    render(
      <ChartPresetPreview
        presets={chartPresets}
        selectedKey="preset.chart.none"
        onSelect={onSelect}
      />
    );

    fireEvent.click(screen.getByRole("radio", { name: /趨勢/ }));

    expect(onSelect).toHaveBeenCalledWith("preset.chart.trend");
  });
});
