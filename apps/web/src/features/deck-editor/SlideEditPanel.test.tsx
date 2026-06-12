// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
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
    outline: [{ id: "b1", text: "bullet one", sourceTrace: [], emphasis: "context" }],
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
  onMoveBullet: vi.fn(),
  onFieldStyle: vi.fn(),
  onFieldStyleReset: vi.fn(),
  onOutlineStyle: vi.fn(),
  onOutlineStyleReset: vi.fn()
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

  // 015 US3: per-field style toolbars — title/message patch by field, bullets by id.
  it("wires style toolbars for title, message and each bullet (by id)", () => {
    const h = handlers();
    render(
      <SlideEditPanel slide={slide({ textStyleOverrides: { title: { sizeLevel: "L" } } })} {...h} />
    );

    // Three toolbars: title, message, one bullet.
    const titleGroup = screen.getByRole("group", { name: "文字樣式 標題" });
    fireEvent.click(within(titleGroup).getByRole("button", { name: "文字大小 XL" }));
    expect(h.onFieldStyle).toHaveBeenCalledWith("title", { sizeLevel: "XL" });
    fireEvent.click(within(titleGroup).getByRole("button", { name: "重設樣式" }));
    expect(h.onFieldStyleReset).toHaveBeenCalledWith("title");

    const messageGroup = screen.getByRole("group", { name: "文字樣式 訊息" });
    fireEvent.click(within(messageGroup).getByRole("button", { name: "文字顏色 強調" }));
    expect(h.onFieldStyle).toHaveBeenCalledWith("message", { colorToken: "accent" });

    const bulletGroup = screen.getByRole("group", { name: "文字樣式 條列 1" });
    fireEvent.click(within(bulletGroup).getByRole("button", { name: "文字大小 S" }));
    expect(h.onOutlineStyle).toHaveBeenCalledWith("b1", { sizeLevel: "S" });
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
