// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { TextStylePanel } from "@/features/deck-editor/TextStylePanel";

afterEach(cleanup);

const noop = () => undefined;

/**
 * 015 US3: the right slide-out free style editor — hex color (picker + hex input) and
 * absolute px size, with per-axis clear and a full reset.
 */
describe("TextStylePanel", () => {
  it("shows the field label when a target is open", () => {
    render(
      <TextStylePanel
        target={{ label: "標題", value: undefined }}
        onPatch={noop}
        onReset={noop}
        onClose={noop}
      />
    );
    expect(screen.getByText("標題")).toBeTruthy();
  });

  it("patches a hex color from the hex input", () => {
    const onPatch = vi.fn();
    render(
      <TextStylePanel
        target={{ label: "標題", value: undefined }}
        onPatch={onPatch}
        onReset={noop}
        onClose={noop}
      />
    );
    const hex = screen.getByLabelText("文字顏色") as HTMLInputElement;
    fireEvent.change(hex, { target: { value: "7170FF" } });
    expect(onPatch).toHaveBeenCalledWith({ color: "#7170FF" });
  });

  it("patches an absolute px size from the slider", () => {
    const onPatch = vi.fn();
    render(
      <TextStylePanel
        target={{ label: "標題", value: undefined }}
        onPatch={onPatch}
        onReset={noop}
        onClose={noop}
      />
    );
    fireEvent.change(screen.getByLabelText("文字大小"), { target: { value: "96" } });
    expect(onPatch).toHaveBeenCalledWith({ sizePx: 96 });
  });

  it("clears a single axis and resets all", () => {
    const onPatch = vi.fn();
    const onReset = vi.fn();
    render(
      <TextStylePanel
        target={{ label: "標題", value: { sizePx: 120, color: "#7170FF" } }}
        onPatch={onPatch}
        onReset={onReset}
        onClose={noop}
      />
    );
    const clears = screen.getAllByRole("button", { name: "清除" });
    expect(clears.length).toBe(2); // one per set axis
    fireEvent.click(screen.getByRole("button", { name: "重設樣式" }));
    expect(onReset).toHaveBeenCalled();
  });

  it("closes via the close button", () => {
    const onClose = vi.fn();
    render(
      <TextStylePanel
        target={{ label: "標題", value: undefined }}
        onPatch={noop}
        onReset={noop}
        onClose={onClose}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: "關閉" }));
    expect(onClose).toHaveBeenCalled();
  });
});
