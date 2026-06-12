import { describe, expect, it } from "vitest";
import { textStyleInlineStyle } from "@/rendering/text-style-override";

/**
 * 015 US3 (FR-007/FR-008, research R3): the ONE place that turns a TextStyleOverride
 * into an inline style fragment. Sizes scale the field's own type variable; colors are
 * palette role vars — both follow the theme automatically.
 */
describe("textStyleInlineStyle", () => {
  it("maps size levels to calc() over the field's type variable", () => {
    expect(textStyleInlineStyle({ sizeLevel: "S" }, "title")).toBe(
      "font-size:calc(var(--type-title) * 0.85)"
    );
    expect(textStyleInlineStyle({ sizeLevel: "L" }, "message")).toBe(
      "font-size:calc(var(--type-message) * 1.25)"
    );
    expect(textStyleInlineStyle({ sizeLevel: "XL" }, "bullet")).toBe(
      "font-size:calc(var(--type-bullet) * 1.6)"
    );
  });

  it("emits nothing for size M (the theme default)", () => {
    expect(textStyleInlineStyle({ sizeLevel: "M" }, "title")).toBe("");
  });

  it("maps color tokens to palette role variables", () => {
    expect(textStyleInlineStyle({ colorToken: "accent" }, "title")).toBe(
      "color:var(--accent)"
    );
    expect(textStyleInlineStyle({ colorToken: "muted" }, "bullet")).toBe(
      "color:var(--muted)"
    );
    expect(textStyleInlineStyle({ colorToken: "heading" }, "message")).toBe(
      "color:var(--heading)"
    );
    // "text" is a REAL override (message defaults to --muted), not a no-op.
    expect(textStyleInlineStyle({ colorToken: "text" }, "message")).toBe(
      "color:var(--text)"
    );
  });

  it("joins size and color with a semicolon", () => {
    expect(textStyleInlineStyle({ sizeLevel: "XL", colorToken: "accent" }, "title")).toBe(
      "font-size:calc(var(--type-title) * 1.6);color:var(--accent)"
    );
  });

  it("returns an empty string for an absent or empty override", () => {
    expect(textStyleInlineStyle(undefined, "title")).toBe("");
    expect(textStyleInlineStyle({}, "bullet")).toBe("");
  });
});
