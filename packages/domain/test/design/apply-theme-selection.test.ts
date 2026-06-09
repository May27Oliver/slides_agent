import { describe, expect, it } from "vitest";
import { applyThemeSelection } from "@/design/apply-theme-selection";
import { composeKit } from "@/design/compose-kit";
import type {
  FontStyleKit,
  PaletteStyleKit,
  SelectableTheme,
  StyleStyleKit
} from "@/design/theme.types";

const fontKit = (heading: string): FontStyleKit => ({
  fonts: { heading, body: '"Inter", sans-serif' }
});

const paletteKit = (base: string): PaletteStyleKit => ({
  accentHues: [{ name: "a", base, gradient: `linear-gradient(135deg, ${base}, ${base})` }],
  accentGradient: `linear-gradient(110deg, ${base}, ${base})`,
  background: { css: base },
  cardSurface: "rgba(255,255,255,.8)",
  cardBorder: `1px solid ${base}`
});

const motion: StyleStyleKit["motion"] = {
  slideTransitionMs: 0,
  slideEasing: "linear",
  entranceMs: 0,
  staggerStepMs: 0,
  microMs: 0,
  respectReducedMotion: true
};

const styleKit = (radius: number): StyleStyleKit => ({
  effects: { cardRadiusPx: radius, cardShadow: "none" },
  motion
});

const CANDIDATES: SelectableTheme[] = [
  { id: "font-00", kind: "font", keywords: [], support: "full", styleKit: fontKit('"Inter"') },
  { id: "font-10", kind: "font", keywords: [], support: "full", styleKit: fontKit('"Archivo"') },
  { id: "palette-00", kind: "palette", keywords: [], support: "full", styleKit: paletteKit("#111") },
  { id: "palette-10", kind: "palette", keywords: [], support: "full", styleKit: paletteKit("#7C3AED") },
  { id: "style-00", kind: "style", keywords: [], support: "full", styleKit: styleKit(12) },
  { id: "style-10", kind: "style", keywords: [], support: "full", styleKit: styleKit(0) }
];

const baseline = { font: "font-00", palette: "palette-00", style: "style-00" };

describe("applyThemeSelection", () => {
  it("overrides only the palette axis; font/style keep the baseline (resolved from candidates)", () => {
    const { selectedTheme, warnings } = applyThemeSelection(
      baseline,
      { paletteId: "palette-10" },
      CANDIDATES
    );

    expect(selectedTheme.ids).toEqual({ font: "font-00", palette: "palette-10", style: "style-00" });
    expect(warnings).toEqual([]);
    expect(selectedTheme.fallback).toBe(false);
    // palette override actually applied: accent hue comes from palette-10 (#7C3AED).
    expect(selectedTheme.styleKit.accentHues[0]?.base).toBe("#7C3AED");
    // baseline font/style preserved.
    expect(selectedTheme.styleKit.fonts.heading).toBe('"Inter"');
    expect(selectedTheme.styleKit.effects.cardRadiusPx).toBe(12);
    expect(selectedTheme.styleKit.kitName).toBe("style-00+palette-10+font-00");
  });

  it("applies all three overrides; ids are the chosen ones and warnings is empty", () => {
    const { selectedTheme, warnings } = applyThemeSelection(
      baseline,
      { fontId: "font-10", paletteId: "palette-10", styleId: "style-10" },
      CANDIDATES
    );

    expect(selectedTheme.ids).toEqual({ font: "font-10", palette: "palette-10", style: "style-10" });
    expect(warnings).toEqual([]);
    expect(selectedTheme.styleKit.fonts.heading).toBe('"Archivo"');
    expect(selectedTheme.styleKit.effects.cardRadiusPx).toBe(0);
  });

  it("falls an invalid override back to default (NOT baseline) with an invalid_id warning", () => {
    const { selectedTheme, warnings } = applyThemeSelection(
      baseline,
      { paletteId: "palette-does-not-exist" },
      CANDIDATES
    );

    // the axis falls back to DEFAULT, so its id is null (not the baseline palette-00).
    expect(selectedTheme.ids.palette).toBeNull();
    expect(selectedTheme.ids.font).toBe("font-00");
    expect(selectedTheme.ids.style).toBe("style-00");
    expect(selectedTheme.fallback).toBe(true);
    expect(warnings).toEqual([
      { axis: "palette", requestedId: "palette-does-not-exist", reason: "invalid_id" }
    ]);
    // default palette applied, not baseline #111.
    const defaultPaletteKit = composeKit({}).accentHues;
    expect(selectedTheme.styleKit.accentHues).toEqual(defaultPaletteKit);
  });

  it("emits base_unresolved (no requestedId) when a baseline axis id is not in the catalogue", () => {
    const { selectedTheme, warnings } = applyThemeSelection(
      { font: "font-00", palette: "palette-removed", style: "style-00" },
      undefined,
      CANDIDATES
    );

    expect(selectedTheme.ids.palette).toBeNull();
    expect(warnings).toEqual([{ axis: "palette", reason: "base_unresolved" }]);
  });

  it("emits base_unresolved when a baseline axis is null (legacy deck)", () => {
    const { warnings } = applyThemeSelection(
      { font: null, palette: "palette-00", style: "style-00" },
      undefined,
      CANDIDATES
    );
    expect(warnings).toEqual([{ axis: "font", reason: "base_unresolved" }]);
  });

  it("with no selection and a fully-resolvable baseline, equals the baseline (no warnings)", () => {
    const { selectedTheme, warnings } = applyThemeSelection(baseline, undefined, CANDIDATES);
    expect(selectedTheme.ids).toEqual(baseline);
    expect(warnings).toEqual([]);
    expect(selectedTheme.fallback).toBe(false);
  });

  it("is a pure, deterministic function (same input → identical output)", () => {
    const a = applyThemeSelection(baseline, { fontId: "font-10" }, CANDIDATES);
    const b = applyThemeSelection(baseline, { fontId: "font-10" }, CANDIDATES);
    expect(a).toEqual(b);
  });
});
