import { describe, expect, it } from "vitest";
import { textStyleInlineStyle } from "@/rendering/text-style-override";

/**
 * 015 US3 (FR-007/FR-008): the ONE place that turns a TextStyleOverride into an inline
 * style fragment — absolute px font-size + hex color (free picker), measured in the
 * 1920×1080 presentation space shared by preview and export.
 */
describe("textStyleInlineStyle", () => {
  it("emits an absolute px font-size", () => {
    expect(textStyleInlineStyle({ sizePx: 72 }, "title")).toBe("font-size:72px");
  });

  it("emits a hex color verbatim", () => {
    expect(textStyleInlineStyle({ color: "#7170FF" }, "bullet")).toBe("color:#7170FF");
  });

  it("joins size and color with a semicolon", () => {
    expect(textStyleInlineStyle({ sizePx: 90, color: "#ff0000" }, "title")).toBe(
      "font-size:90px;color:#ff0000"
    );
  });

  it("returns an empty string for an absent or empty override (theme default applies)", () => {
    expect(textStyleInlineStyle(undefined, "title")).toBe("");
    expect(textStyleInlineStyle({}, "bullet")).toBe("");
  });

  it("ignores a non-finite size", () => {
    expect(textStyleInlineStyle({ sizePx: Number.NaN }, "title")).toBe("");
  });
});
