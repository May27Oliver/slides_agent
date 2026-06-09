// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { StyleCardGallery } from "@/features/slide-generation/StyleCardGallery";
import { stylePresets } from "@/features/slide-generation/style-presets";

afterEach(() => {
  cleanup();
});

describe("StyleCardGallery", () => {
  it("renders six accessible style card radios with preview details", () => {
    render(
      <fieldset>
        <legend>風格預設</legend>
        <StyleCardGallery presets={stylePresets} selectedKey="" onSelect={vi.fn()} />
      </fieldset>
    );

    const group = screen.getByRole("group", { name: "風格預設" });

    expect(within(group).getAllByRole("radio")).toHaveLength(6);
    expect(within(group).getByRole("radio", { name: /專業商務/ })).toBeTruthy();
    expect(within(group).getByText("穩重資訊")).toBeTruthy();
    expect(within(group).getByText(/中高密度/)).toBeTruthy();
  });

  it("calls onSelect with the preset key when a card is selected", () => {
    const onSelect = vi.fn();

    render(<StyleCardGallery presets={stylePresets} selectedKey="" onSelect={onSelect} />);

    fireEvent.click(screen.getByRole("radio", { name: /科技新創/ }));

    expect(onSelect).toHaveBeenCalledWith("preset.style.tech");
  });
});
