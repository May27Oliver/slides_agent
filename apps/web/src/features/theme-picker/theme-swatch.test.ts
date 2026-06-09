import { describe, expect, it } from "vitest";
import type { BrowsableTheme } from "@slides-agent/domain";
import { extractSwatch } from "@/features/theme-picker/theme-swatch";

const theme = (
  over: Partial<BrowsableTheme> & Pick<BrowsableTheme, "kind" | "styleKit">
): BrowsableTheme => ({
  id: "t",
  name: "T",
  keywords: [],
  support: "full",
  ...over
});

describe("extractSwatch", () => {
  it("pulls accent colours + background from a palette kit", () => {
    const swatch = extractSwatch(
      theme({
        kind: "palette",
        styleKit: {
          accentHues: [{ base: "#111" }, { base: "#7C3AED" }, { base: "#0AF" }],
          background: { css: "#FFF" }
        }
      })
    );
    expect(swatch).toEqual({
      kind: "palette",
      colors: ["#111", "#7C3AED", "#0AF"],
      background: "#FFF"
    });
  });

  it("pulls heading/body family names from a font kit", () => {
    const swatch = extractSwatch(
      theme({ kind: "font", styleKit: { fonts: { heading: '"Archivo"', body: '"Inter"' } } })
    );
    expect(swatch).toEqual({ kind: "font", heading: '"Archivo"', body: '"Inter"' });
  });

  it("pulls radius/shadow from a style kit", () => {
    const swatch = extractSwatch(
      theme({
        kind: "style",
        styleKit: { effects: { cardRadiusPx: 0, cardShadow: "4px 4px 0 #000" } }
      })
    );
    expect(swatch).toEqual({ kind: "style", radiusPx: 0, shadow: "4px 4px 0 #000" });
  });

  it("drops CSS-unsafe colour values at the use boundary (no url()/breakout reaches inline style)", () => {
    const swatch = extractSwatch(
      theme({
        kind: "palette",
        styleKit: {
          accentHues: [
            { base: "#111" },
            { base: "url(https://evil.example/x)" },
            { base: "red;}" }
          ],
          background: { css: "url(https://evil.example/bg)" }
        }
      })
    );
    expect(swatch).toEqual({ kind: "palette", colors: ["#111"], background: null });
  });

  it("returns null for a non-object styleKit and tolerates missing fields", () => {
    expect(extractSwatch(theme({ kind: "palette", styleKit: null }))).toBeNull();
    expect(extractSwatch(theme({ kind: "palette", styleKit: {} }))).toEqual({
      kind: "palette",
      colors: [],
      background: null
    });
  });
});
