// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { TextStyleOverride } from "@slides-agent/domain";
import { TextStylePanel } from "@/features/deck-editor/TextStylePanel";
import type { TextStylePatch } from "@/features/deck-editor/editable-slide-draft";

afterEach(cleanup);

const noop = () => undefined;

function renderPanel(
  overrides: {
    value?: TextStyleOverride | undefined;
    fonts?: readonly string[];
    onPatch?: (patch: TextStylePatch) => void;
    onReset?: () => void;
    onClose?: () => void;
  } = {}
) {
  return render(
    <TextStylePanel
      target={{ label: "標題", value: overrides.value }}
      fonts={overrides.fonts ?? []}
      fontPreviewHref={null}
      onPatch={overrides.onPatch ?? noop}
      onReset={overrides.onReset ?? noop}
      onClose={overrides.onClose ?? noop}
    />
  );
}

/**
 * 015 US3: the right slide-out free style editor — font family, hex color (picker +
 * hex input) and absolute px size, with per-axis clear and a full reset.
 */
describe("TextStylePanel", () => {
  it("shows the field label when a target is open", () => {
    renderPanel();
    expect(screen.getByText("標題")).toBeTruthy();
  });

  it("lists the catalogue fonts and patches the picked family", () => {
    const onPatch = vi.fn();
    renderPanel({ fonts: ["Inter", "Playfair Display"], onPatch });
    const select = screen.getByLabelText("字型") as HTMLSelectElement;
    // default + 2 families.
    expect(select.options.length).toBe(3);
    fireEvent.change(select, { target: { value: "Playfair Display" } });
    expect(onPatch).toHaveBeenCalledWith({ fontFamily: "Playfair Display" });
    // Picking the default clears the family.
    fireEvent.change(select, { target: { value: "" } });
    expect(onPatch).toHaveBeenLastCalledWith({ fontFamily: undefined });
  });

  it("patches a hex color from the hex input", () => {
    const onPatch = vi.fn();
    renderPanel({ onPatch });
    const hex = screen.getByLabelText("文字顏色") as HTMLInputElement;
    fireEvent.change(hex, { target: { value: "7170FF" } });
    expect(onPatch).toHaveBeenCalledWith({ color: "#7170FF" });
  });

  it("patches an absolute px size from the slider", () => {
    const onPatch = vi.fn();
    renderPanel({ onPatch });
    fireEvent.change(screen.getByLabelText("文字大小"), { target: { value: "96" } });
    expect(onPatch).toHaveBeenCalledWith({ sizePx: 96 });
  });

  it("clears a single axis and resets all", () => {
    const onReset = vi.fn();
    renderPanel({ value: { sizePx: 120, color: "#7170FF", fontFamily: "Inter" }, onReset });
    const clears = screen.getAllByRole("button", { name: "清除" });
    expect(clears.length).toBe(2); // one per set color/size axis
    fireEvent.click(screen.getByRole("button", { name: "重設樣式" }));
    expect(onReset).toHaveBeenCalled();
  });

  it("closes via the close button", () => {
    const onClose = vi.fn();
    renderPanel({ onClose });
    fireEvent.click(screen.getByRole("button", { name: "關閉" }));
    expect(onClose).toHaveBeenCalled();
  });
});
