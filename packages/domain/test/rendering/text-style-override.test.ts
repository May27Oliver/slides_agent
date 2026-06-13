import { describe, expect, it } from "vitest";
import type { SlideDeck } from "@/deck/deck.types";
import {
  buildOverrideFontsHref,
  collectOverrideFontFamilies,
  textStyleInlineStyle
} from "@/rendering/text-style-override";

/**
 * 015 US3 (FR-007/FR-008): the ONE place that turns a TextStyleOverride into an inline
 * style fragment — absolute px font-size + hex color (free picker), measured in the
 * 1920×1080 presentation space shared by preview and export.
 */
describe("textStyleInlineStyle", () => {
  it("emits an absolute px font-size", () => {
    expect(textStyleInlineStyle({ sizePx: 72 })).toBe("font-size:72px");
  });

  it("emits a hex color verbatim", () => {
    expect(textStyleInlineStyle({ color: "#7170FF" })).toBe("color:#7170FF");
  });

  it("joins size and color with a semicolon", () => {
    expect(textStyleInlineStyle({ sizePx: 90, color: "#ff0000" })).toBe(
      "font-size:90px;color:#ff0000"
    );
  });

  it("returns an empty string for an absent or empty override (theme default applies)", () => {
    expect(textStyleInlineStyle(undefined)).toBe("");
    expect(textStyleInlineStyle({})).toBe("");
  });

  it("ignores a non-finite size", () => {
    expect(textStyleInlineStyle({ sizePx: Number.NaN })).toBe("");
  });

  it("emits a single-quoted font family with the theme fallback stack", () => {
    expect(textStyleInlineStyle({ fontFamily: "Playfair Display" })).toBe(
      "font-family:'Playfair Display', 'Noto Sans TC', system-ui, -apple-system, sans-serif"
    );
  });
});

function deckWith(
  overridesBySlide: Array<SlideDeck["slides"][number]["textStyleOverrides"]>
): SlideDeck {
  return {
    id: "d",
    title: "t",
    purpose: "p",
    audience: "a",
    slides: overridesBySlide.map((textStyleOverrides, i) => ({
      id: `s${i}`,
      slideKind: "content",
      type: "content",
      title: "",
      message: "",
      outline: [],
      layout: "title-bullets",
      layoutIntent: { priority: "message_first", density: "medium", emphasis: "narrative" },
      contentBlocks: [],
      sourceTrace: [],
      speakerNotesDraft: "",
      ...(textStyleOverrides ? { textStyleOverrides } : {})
    })),
    reviewReport: {
      assumptions: [],
      omittedOrCompressedContent: [],
      uncertainClaims: [],
      chartingDecisions: [],
      humanReviewNotes: []
    }
  };
}

describe("collectOverrideFontFamilies / buildOverrideFontsHref", () => {
  it("collects the distinct families used across title/message/outline, sorted", () => {
    const deck = deckWith([
      { title: { fontFamily: "Poppins" }, message: { fontFamily: "Inter" } },
      { outlineById: { b1: { fontFamily: "Inter" }, b2: { fontFamily: "Lora" } } },
      undefined
    ]);
    expect(collectOverrideFontFamilies(deck)).toEqual(["Inter", "Lora", "Poppins"]);
  });

  it("builds a Google Fonts href that loads the families (spaces → +); null when none", () => {
    expect(buildOverrideFontsHref([])).toBeNull();
    expect(buildOverrideFontsHref(["Playfair Display", "Inter"])).toBe(
      "https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;500;600;700&family=Inter:wght@400;500;600;700&display=swap"
    );
  });
});
