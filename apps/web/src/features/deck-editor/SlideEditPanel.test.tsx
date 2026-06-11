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

  // 014: the read-only notice is retired — charts edit through the card; every other
  // contentBlock kind is a planning artifact the renderer never draws (it reads ONLY
  // chart_placeholder), so there is nothing meaningful to disclose.
  it("renders the chart editor slot and no read-only notice", () => {
    const h = handlers();
    render(
      <SlideEditPanel
        slide={slide({
          contentBlocks: [
            { kind: "chart_placeholder", content: {}, chartIntentId: "chart-0" },
            { kind: "bullets", content: {} }
          ]
        })}
        {...h}
        chartEditor={<div data-testid="chart-editor-slot">card</div>}
      />
    );
    expect(screen.getByTestId("chart-editor-slot")).toBeTruthy();
    expect(screen.queryByText("本期暫不可編輯")).toBeNull();
    expect(screen.queryByText("bullets")).toBeNull();
    expect(screen.queryByText("chart_placeholder")).toBeNull();
  });
});
