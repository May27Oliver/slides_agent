import { describe, expect, it } from "vitest";
import { parseThemeSelection, MAX_THEME_ID_CHARS } from "@/theme-selection";

describe("parseThemeSelection (011)", () => {
  it("treats undefined as ok with no value (no manual override)", () => {
    expect(parseThemeSelection(undefined)).toEqual({ ok: true });
  });

  it("passes through a valid per-axis selection", () => {
    expect(parseThemeSelection({ fontId: "font-10", paletteId: "palette-00" })).toEqual({
      ok: true,
      value: { fontId: "font-10", paletteId: "palette-00" }
    });
  });

  it("drops empty-string axes and yields no value when nothing remains", () => {
    expect(parseThemeSelection({ fontId: "", styleId: "" })).toEqual({ ok: true });
  });

  it("rejects a non-object selection", () => {
    expect(parseThemeSelection("nope")).toEqual({ ok: false, fields: ["themeSelection"] });
    expect(parseThemeSelection(["a"])).toEqual({ ok: false, fields: ["themeSelection"] });
  });

  it("rejects a non-string axis value with the offending field path", () => {
    expect(parseThemeSelection({ fontId: 123 })).toEqual({
      ok: false,
      fields: ["themeSelection.fontId"]
    });
  });

  it("rejects an over-length axis id", () => {
    const tooLong = "x".repeat(MAX_THEME_ID_CHARS + 1);
    expect(parseThemeSelection({ paletteId: tooLong })).toEqual({
      ok: false,
      fields: ["themeSelection.paletteId"]
    });
  });

  it("collects every offending axis", () => {
    const result = parseThemeSelection({ fontId: 1, paletteId: true, styleId: "ok" });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.fields).toEqual(["themeSelection.fontId", "themeSelection.paletteId"]);
  });
});
