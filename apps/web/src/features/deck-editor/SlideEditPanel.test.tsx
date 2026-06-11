// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { Slide } from "@slides-agent/domain";
import { SlideEditPanel } from "@/features/deck-editor/SlideEditPanel";

afterEach(cleanup);

function slide(over: Partial<Slide> = {}): Slide {
  return {
    id: "s1",
    slideKind: "content",
    type: "content",
    title: "Hello",
    message: "World",
    outline: [{ text: "bullet one", sourceTrace: [], emphasis: "context" }],
    layout: "title-bullets",
    layoutIntent: { priority: "message_first", density: "medium", emphasis: "narrative" },
    contentBlocks: [],
    sourceTrace: [],
    speakerNotesDraft: "notes",
    ...over
  };
}

const handlers = () => ({
  onTitle: vi.fn(),
  onMessage: vi.fn(),
  onNotes: vi.fn(),
  onOutlineText: vi.fn(),
  onAddBullet: vi.fn(),
  onRemoveBullet: vi.fn(),
  onMoveBullet: vi.fn()
});

describe("SlideEditPanel (010 US1)", () => {
  it("edits the grounded four fields", () => {
    const h = handlers();
    render(<SlideEditPanel slide={slide()} {...h} />);

    fireEvent.change(screen.getByDisplayValue("Hello"), { target: { value: "New title" } });
    expect(h.onTitle).toHaveBeenCalledWith("New title");

    fireEvent.change(screen.getByDisplayValue("World"), { target: { value: "New message" } });
    expect(h.onMessage).toHaveBeenCalledWith("New message");

    fireEvent.change(screen.getByDisplayValue("bullet one"), {
      target: { value: "edited bullet" }
    });
    expect(h.onOutlineText).toHaveBeenCalledWith(0, "edited bullet");

    fireEvent.change(screen.getByDisplayValue("notes"), { target: { value: "new notes" } });
    expect(h.onNotes).toHaveBeenCalledWith("new notes");
  });

  it("adds and removes bullets", () => {
    const h = handlers();
    render(<SlideEditPanel slide={slide()} {...h} />);
    fireEvent.click(screen.getByText(/新增條列/));
    expect(h.onAddBullet).toHaveBeenCalled();
    fireEvent.click(screen.getByLabelText("刪除此條"));
    expect(h.onRemoveBullet).toHaveBeenCalledWith(0);
  });

  it("shows a read-only notice listing content block kinds when present", () => {
    const h = handlers();
    render(
      <SlideEditPanel
        slide={slide({ contentBlocks: [{ kind: "chart_placeholder", content: {} }] })}
        {...h}
      />
    );
    expect(screen.getByText("chart_placeholder")).toBeTruthy();
    expect(screen.getAllByText("本期暫不可編輯").length).toBeGreaterThan(0);
  });

  // 014 US1: the chart area becomes an editor card; only NON-chart blocks stay readonly.
  it("renders the chart editor slot and stops listing chart_placeholder as readonly", () => {
    const h = handlers();
    render(
      <SlideEditPanel
        slide={slide({
          contentBlocks: [
            { kind: "chart_placeholder", content: {}, chartIntentId: "chart-0" },
            { kind: "table", content: {} }
          ]
        })}
        {...h}
        chartEditor={<div data-testid="chart-editor-slot">card</div>}
      />
    );
    expect(screen.getByTestId("chart-editor-slot")).toBeTruthy();
    // chart_placeholder is editable through the card now; table stays readonly.
    expect(screen.queryByText("chart_placeholder")).toBeNull();
    expect(screen.getByText("table")).toBeTruthy();
  });
});
