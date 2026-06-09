// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import type { BrowsableTheme, ThemeCatalog } from "@slides-agent/domain";
import { ThemeBrowserModal } from "@/features/theme-picker/ThemeBrowserModal";

afterEach(cleanup);

const t = (id: string, name: string, kind: BrowsableTheme["kind"]): BrowsableTheme => ({
  id,
  kind,
  name,
  keywords: [name.toLowerCase()],
  support: "full",
  styleKit: kind === "palette" ? { accentHues: [{ base: "#111" }] } : {}
});

const catalog: ThemeCatalog = {
  font: [t("font-00", "Inter", "font"), t("font-10", "Archivo", "font")],
  palette: [t("palette-00", "Neutral", "palette"), t("palette-10", "Violet", "palette")],
  style: [t("style-00", "Minimal", "style")]
};

function open(overrides: Partial<Parameters<typeof ThemeBrowserModal>[0]> = {}) {
  const onApply = vi.fn();
  const onClose = vi.fn();
  render(
    <ThemeBrowserModal
      catalog={catalog}
      initialSelection={{}}
      onApply={onApply}
      onClose={onClose}
      {...overrides}
    />
  );
  return { onApply, onClose };
}

describe("ThemeBrowserModal", () => {
  it("renders as a dialog with the three axis tabs", () => {
    open();
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByRole("tab", { name: "字體" })).toBeTruthy();
    expect(within(dialog).getByRole("tab", { name: "配色" })).toBeTruthy();
    expect(within(dialog).getByRole("tab", { name: "風格" })).toBeTruthy();
  });

  it("picks an id on the active axis and returns the combined selection on Apply", () => {
    const { onApply } = open();
    // default axis = font; switch to palette and pick Violet.
    fireEvent.click(screen.getByRole("tab", { name: "配色" }));
    fireEvent.click(screen.getByText("Violet"));
    fireEvent.click(screen.getByText("套用"));
    expect(onApply).toHaveBeenCalledWith({ paletteId: "palette-10" });
  });

  it("filters the active axis list by the search query", () => {
    open();
    fireEvent.click(screen.getByRole("tab", { name: "配色" }));
    fireEvent.change(screen.getByPlaceholderText("搜尋主題…"), { target: { value: "violet" } });
    expect(screen.getByText("Violet")).toBeTruthy();
    expect(screen.queryByText("Neutral")).toBeNull();
  });

  it("clears a picked axis back to auto", () => {
    const { onApply } = open({ initialSelection: { fontId: "font-10" } });
    fireEvent.click(screen.getByText("清除（改用自動）"));
    fireEvent.click(screen.getByText("套用"));
    expect(onApply).toHaveBeenCalledWith({});
  });

  it("closes on Escape", () => {
    const { onClose } = open();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalled();
  });

  it("is an accessible modal: aria-modal + initial focus inside the dialog (a11y)", () => {
    open();
    const dialog = screen.getByRole("dialog");
    expect(dialog.getAttribute("aria-modal")).toBe("true");
    // focus is moved into the dialog on open (focus trap), not left on the body.
    expect(dialog === document.activeElement || dialog.contains(document.activeElement)).toBe(true);
  });

  it("marks the active tab with aria-selected", () => {
    open();
    fireEvent.click(screen.getByRole("tab", { name: "配色" }));
    expect(screen.getByRole("tab", { name: "配色" }).getAttribute("aria-selected")).toBe("true");
    expect(screen.getByRole("tab", { name: "字體" }).getAttribute("aria-selected")).toBe("false");
  });
});
