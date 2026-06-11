// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { Slide } from "@slides-agent/domain";
import { SlideNavigator } from "@/features/deck-editor/SlideNavigator";

afterEach(cleanup);

function slide(id: string, over: Partial<Slide> = {}): Slide {
  return {
    id,
    slideKind: "content",
    type: "content",
    title: `Title ${id}`,
    message: "m",
    outline: [],
    layout: "title-bullets",
    layoutIntent: { priority: "message_first", density: "medium", emphasis: "narrative" },
    contentBlocks: [],
    sourceTrace: [],
    speakerNotesDraft: "",
    ...over
  };
}

const noop = () => undefined;

describe("SlideNavigator (010 US1)", () => {
  it("renders a numbered text list without the retired read-only badge (014)", () => {
    render(
      <SlideNavigator
        slides={[
          slide("s1"),
          slide("s2", { contentBlocks: [{ kind: "chart_placeholder", content: {} }] })
        ]}
        selectedId="s1"
        onSelect={noop}
        onAddSlide={noop}
        onRemoveSlide={noop}
        onMoveSlide={noop}
      />
    );
    expect(screen.getByText("01")).toBeTruthy();
    expect(screen.getByText("Title s1")).toBeTruthy();
    // 014: charts are editable through the chart card, so no read-only flag.
    expect(screen.queryByText("本期暫不可編輯")).toBeNull();
  });

  it("calls onSelect / onAddSlide / onRemoveSlide and exposes drag handles", () => {
    const onSelect = vi.fn();
    const onAddSlide = vi.fn();
    const onMoveSlide = vi.fn();
    const onRemoveSlide = vi.fn();
    render(
      <SlideNavigator
        slides={[slide("s1"), slide("s2")]}
        selectedId="s1"
        onSelect={onSelect}
        onAddSlide={onAddSlide}
        onRemoveSlide={onRemoveSlide}
        onMoveSlide={onMoveSlide}
      />
    );

    fireEvent.click(screen.getByText("Title s2"));
    expect(onSelect).toHaveBeenCalledWith("s2");

    fireEvent.click(screen.getByText(/新增投影片/));
    expect(onAddSlide).toHaveBeenCalledWith("s1");

    // Reorder is drag-and-drop now: each row exposes a keyboard-operable drag handle.
    // (The reorder math is covered by EditableSlideDraft.moveSlide; jsdom can't drive
    //  pointer-sensor drag.)
    expect(screen.getAllByLabelText(/拖曳排序/).length).toBe(2);

    fireEvent.click(screen.getAllByLabelText("刪除投影片")[0]!);
    expect(onRemoveSlide).toHaveBeenCalledWith("s1");
  });

  it("disables remove when only one slide remains", () => {
    render(
      <SlideNavigator
        slides={[slide("s1")]}
        selectedId="s1"
        onSelect={noop}
        onAddSlide={noop}
        onRemoveSlide={noop}
        onMoveSlide={noop}
      />
    );
    expect(screen.getByLabelText("刪除投影片").hasAttribute("disabled")).toBe(true);
  });
});
