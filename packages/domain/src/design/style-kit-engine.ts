/**
 * Deterministic expansion engine that turns curated CSV source values
 * (CuratedPalette / CuratedFontPairing) into the partial DesignStyleKit tokens
 * stored per theme row. Kept in code (the engine) per the project principle —
 * only the *output* tokens land in the DB. The dev-time CSV→seed converter
 * (feature 007 US2) reuses these so the 96 palettes / 56 font pairings expand the
 * same way the legacy in-process selection did.
 */

import type { AccentHue } from "@/design/design-style-kit.types";
import type { FontStyleKit, PaletteStyleKit } from "@/design/theme.types";
import type { CuratedFontPairing, CuratedPalette } from "@/design/ui-ux-pro-max-knowledge";

/** Expands a curated palette into the palette-axis partial kit (colour fields). */
export function expandPalette(palette: CuratedPalette): PaletteStyleKit {
  return {
    accentHues: buildPaletteHues(palette),
    accentGradient: `linear-gradient(110deg, ${palette.primary} 0%, ${palette.secondary} 55%, ${palette.cta} 100%)`,
    background: { css: buildBackground(palette) },
    cardSurface: palette.dark ? "rgba(24, 24, 27, .72)" : "rgba(255, 255, 255, .84)",
    cardBorder: `1px solid ${hexToRgba(palette.border, palette.dark ? 0.34 : 0.86)}`
  };
}

/** Expands a curated font pairing into the font-axis partial kit. */
export function expandFontPairing(pairing: CuratedFontPairing): FontStyleKit {
  return {
    fonts: {
      heading: `"${pairing.headingFamily}", "Noto Sans TC", system-ui, -apple-system, sans-serif`,
      body: `"${pairing.bodyFamily}", "Noto Sans TC", system-ui, -apple-system, sans-serif`,
      googleFontsHref: buildGoogleFontsHref(pairing)
    }
  };
}

export function buildPaletteHues(palette: CuratedPalette): AccentHue[] {
  const pairs: Array<{ name: string; base: string; pair: string }> = [
    { name: "primary", base: palette.primary, pair: palette.secondary },
    { name: "secondary", base: palette.secondary, pair: palette.cta },
    { name: "cta", base: palette.cta, pair: palette.primary },
    { name: "mint", base: "#4ECDC4", pair: "#06B6A4" },
    { name: "sky", base: "#5BC0EB", pair: "#3B82F6" },
    { name: "lavender", base: "#A78BFA", pair: "#7C3AED" }
  ];

  return pairs.map((entry) => ({
    name: entry.name,
    base: entry.base,
    gradient: `linear-gradient(135deg, ${entry.base}, ${entry.pair})`
  }));
}

export function buildGoogleFontsHref(pairing: CuratedFontPairing): string {
  const families = Object.entries(pairing.weights).map(
    ([family, weights]) => `family=${encodeFamily(family)}:wght@${weights}`
  );
  families.push("family=Noto+Sans+TC:wght@300;400;500;700;900");
  return `https://fonts.googleapis.com/css2?${families.join("&")}&display=swap`;
}

export function buildBackground(palette: CuratedPalette): string {
  if (palette.dark) {
    return [
      `radial-gradient(1200px 800px at 12% 0%, ${palette.primary}2E 0%, transparent 60%)`,
      `radial-gradient(900px 700px at 100% 100%, ${palette.secondary}24 0%, transparent 60%)`,
      palette.background
    ].join(", ");
  }
  return [
    `radial-gradient(1200px 800px at 10% 0%, ${palette.primary}22 0%, transparent 60%)`,
    `radial-gradient(900px 700px at 100% 100%, ${palette.secondary}1F 0%, transparent 60%)`,
    `radial-gradient(700px 500px at 50% 50%, ${palette.cta}1A 0%, transparent 70%)`,
    palette.background
  ].join(", ");
}

function encodeFamily(family: string): string {
  return family.replace(/\s+/gu, "+");
}

function hexToRgba(hex: string, alpha: number): string {
  const parsed = Number.parseInt(hex.replace("#", "").slice(0, 6), 16);
  if (!Number.isFinite(parsed)) {
    return `rgba(0, 0, 0, ${alpha})`;
  }
  const red = (parsed >> 16) & 255;
  const green = (parsed >> 8) & 255;
  const blue = parsed & 255;
  const safeAlpha = Math.min(1, Math.max(0, alpha));
  return `rgba(${red}, ${green}, ${blue}, ${safeAlpha})`;
}
