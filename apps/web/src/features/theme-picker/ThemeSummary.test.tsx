// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ThemeCatalog } from "@slides-agent/domain";
import { ThemeSummary } from "@/features/theme-picker/ThemeSummary";

afterEach(cleanup);

const catalog: ThemeCatalog = {
  font: [{ id: "font-10", kind: "font", name: "Archivo", keywords: [], support: "full", styleKit: {} }],
  palette: [
    { id: "palette-10", kind: "palette", name: "Violet", keywords: [], support: "full", styleKit: {} }
  ],
  style: [{ id: "style-10", kind: "style", name: "Brutalism", keywords: [], support: "full", styleKit: {} }]
};

describe("ThemeSummary", () => {
  it("shows the resolved name for a picked axis and 自動 for unset axes", () => {
    render(
      <ThemeSummary selection={{ paletteId: "palette-10" }} catalog={catalog} onBrowse={() => {}} />
    );
    expect(screen.getByText("Violet")).toBeTruthy();
    // font + style unset → both show 自動.
    expect(screen.getAllByText("自動").length).toBe(2);
  });

  it("invokes onBrowse when the browse button is clicked", () => {
    const onBrowse = vi.fn();
    render(<ThemeSummary selection={{}} catalog={catalog} onBrowse={onBrowse} />);
    fireEvent.click(screen.getByText(/瀏覽全部主題/));
    expect(onBrowse).toHaveBeenCalledOnce();
  });

  it("honestly discloses a fallback warning (default, not auto)", () => {
    render(
      <ThemeSummary
        selection={{}}
        catalog={catalog}
        onBrowse={() => {}}
        warnings={[{ axis: "palette", requestedId: "x", reason: "invalid_id" }]}
      />
    );
    expect(screen.getByText(/已改用預設主題/)).toBeTruthy();
  });
});
