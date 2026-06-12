// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { TextStyleToolbar } from "@/features/deck-editor/TextStyleToolbar";

afterEach(cleanup);

/**
 * 015 US3 (FR-007/008/011): the per-field style toolbar — four size steps, four theme
 * color tokens (no free hex), single-property toggle-off, full reset.
 */
describe("TextStyleToolbar", () => {
  it("offers exactly the S/M/L/XL steps and the four theme color tokens", () => {
    render(<TextStyleToolbar label="標題" value={undefined} onPatch={() => {}} onReset={() => {}} />);
    for (const size of ["S", "M", "L", "XL"]) {
      expect(screen.getByRole("button", { name: `文字大小 ${size}` })).toBeTruthy();
    }
    for (const color of ["預設文字", "強調", "次要", "標題色"]) {
      expect(screen.getByRole("button", { name: `文字顏色 ${color}` })).toBeTruthy();
    }
    // No free color input — tokens only (FR-008).
    expect(document.querySelector('input[type="color"]')).toBeNull();
  });

  it("patches the picked size and toggles it off when re-picked", () => {
    const onPatch = vi.fn();
    const { rerender } = render(
      <TextStyleToolbar label="標題" value={undefined} onPatch={onPatch} onReset={() => {}} />
    );
    fireEvent.click(screen.getByRole("button", { name: "文字大小 L" }));
    expect(onPatch).toHaveBeenCalledWith({ sizeLevel: "L" });

    rerender(
      <TextStyleToolbar
        label="標題"
        value={{ sizeLevel: "L" }}
        onPatch={onPatch}
        onReset={() => {}}
      />
    );
    const active = screen.getByRole("button", { name: "文字大小 L" });
    expect(active.getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(active);
    expect(onPatch).toHaveBeenLastCalledWith({ sizeLevel: undefined });
  });

  it("patches the picked color token and toggles it off when re-picked", () => {
    const onPatch = vi.fn();
    render(
      <TextStyleToolbar
        label="標題"
        value={{ colorToken: "accent" }}
        onPatch={onPatch}
        onReset={() => {}}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: "文字顏色 次要" }));
    expect(onPatch).toHaveBeenCalledWith({ colorToken: "muted" });
    fireEvent.click(screen.getByRole("button", { name: "文字顏色 強調" }));
    expect(onPatch).toHaveBeenLastCalledWith({ colorToken: undefined });
  });

  it("shows the full reset only when an override exists", () => {
    const onReset = vi.fn();
    const { rerender } = render(
      <TextStyleToolbar label="標題" value={undefined} onPatch={() => {}} onReset={onReset} />
    );
    expect(screen.queryByRole("button", { name: "重設樣式" })).toBeNull();

    rerender(
      <TextStyleToolbar
        label="標題"
        value={{ sizeLevel: "XL" }}
        onPatch={() => {}}
        onReset={onReset}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: "重設樣式" }));
    expect(onReset).toHaveBeenCalled();
  });
});
