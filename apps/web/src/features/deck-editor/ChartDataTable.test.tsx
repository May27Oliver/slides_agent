// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ChartIntent } from "@slides-agent/domain";
import { ChartDataTable } from "@/features/deck-editor/ChartDataTable";

afterEach(cleanup);

const intent: ChartIntent = {
  id: "chart-0",
  title: "市占比較",
  sourceFacts: [
    { id: "f1", kind: "metric", value: "45%", sourceText: "產品A 占 45%" },
    { id: "f2", kind: "metric", value: "55%", sourceText: "產品B 占 55%" }
  ],
  recommendedVisuals: ["comparison"],
  rationale: "market share"
};

describe("ChartDataTable (014 US3)", () => {
  it("derives the base rows from the intent's facts with source badges", () => {
    render(<ChartDataTable intent={intent} pendingEdit={null} onEdit={vi.fn()} onResetAll={null} />);
    // Parsed label/value/unit from the fact's free text.
    expect(screen.getByDisplayValue("產品A")).toBeTruthy();
    expect(screen.getByDisplayValue("45")).toBeTruthy();
    expect(screen.getAllByText("來源資料")).toHaveLength(2);
    expect(screen.queryByText("使用者提供")).toBeNull();
  });

  it("editing an original value converts the row to a user point carrying replacesFactId", () => {
    const onEdit = vi.fn();
    render(<ChartDataTable intent={intent} pendingEdit={null} onEdit={onEdit} onResetAll={null} />);
    fireEvent.change(screen.getByDisplayValue("45"), { target: { value: "48" } });
    expect(onEdit).toHaveBeenCalledWith(
      [
        {
          kind: "user",
          point: { label: "產品A", valueText: "48", unit: "%" },
          replacesFactId: "f1"
        },
        { kind: "original", sourceFactId: "f2" }
      ],
      undefined
    );
  });

  it("renders pending user rows with the user badge and a restore button", () => {
    const onEdit = vi.fn();
    render(
      <ChartDataTable
        intent={intent}
        pendingEdit={{
          points: [
            {
              kind: "user",
              point: { label: "產品A", valueText: "48", unit: "%" },
              replacesFactId: "f1"
            },
            { kind: "original", sourceFactId: "f2" }
          ]
        }}
        onEdit={onEdit}
        onResetAll={vi.fn()}
      />
    );
    expect(screen.getByText("使用者提供")).toBeTruthy();

    fireEvent.click(screen.getByLabelText("還原此點"));
    expect(onEdit).toHaveBeenCalledWith(
      [
        { kind: "original", sourceFactId: "f1" },
        { kind: "original", sourceFactId: "f2" }
      ],
      undefined
    );
  });

  it("adds and removes rows through the full-list edit", () => {
    const onEdit = vi.fn();
    render(<ChartDataTable intent={intent} pendingEdit={null} onEdit={onEdit} onResetAll={null} />);

    fireEvent.click(screen.getByText(/新增數據點/));
    expect(onEdit).toHaveBeenCalledWith(
      [
        { kind: "original", sourceFactId: "f1" },
        { kind: "original", sourceFactId: "f2" },
        { kind: "user", point: { label: "", valueText: "", unit: null } }
      ],
      undefined
    );

    onEdit.mockClear();
    fireEvent.click(screen.getAllByLabelText("刪除此點")[0]!);
    expect(onEdit).toHaveBeenCalledWith([{ kind: "original", sourceFactId: "f2" }], undefined);
  });

  it("edits the chart title alongside the points", () => {
    const onEdit = vi.fn();
    render(<ChartDataTable intent={intent} pendingEdit={null} onEdit={onEdit} onResetAll={null} />);
    fireEvent.change(screen.getByDisplayValue("市占比較"), { target: { value: "新標題" } });
    expect(onEdit).toHaveBeenCalledWith(
      [
        { kind: "original", sourceFactId: "f1" },
        { kind: "original", sourceFactId: "f2" }
      ],
      "新標題"
    );
  });

  it("flags an invalid valueText inline (UX only; the server stays authoritative)", () => {
    render(
      <ChartDataTable
        intent={intent}
        pendingEdit={{
          points: [{ kind: "user", point: { label: "x", valueText: "abc", unit: null } }]
        }}
        onEdit={vi.fn()}
        onResetAll={vi.fn()}
      />
    );
    expect(screen.getByText("需為數字（可含小數與負號）")).toBeTruthy();
  });

  it("offers reset-all only when edits are pending", () => {
    const onResetAll = vi.fn();
    const { rerender } = render(
      <ChartDataTable intent={intent} pendingEdit={null} onEdit={vi.fn()} onResetAll={null} />
    );
    expect(screen.queryByText("還原圖表編輯")).toBeNull();

    rerender(
      <ChartDataTable
        intent={intent}
        pendingEdit={{ points: [{ kind: "original", sourceFactId: "f1" }] }}
        onEdit={vi.fn()}
        onResetAll={onResetAll}
      />
    );
    fireEvent.click(screen.getByText("還原圖表編輯"));
    expect(onResetAll).toHaveBeenCalled();
  });
});
