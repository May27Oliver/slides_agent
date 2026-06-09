import type { BrowsableTheme } from "@slides-agent/domain";

/**
 * 011: derive a lightweight, renderable swatch from a theme's trusted-builtin partial
 * styleKit (data-model §5) — the picker never deck-renders the catalogue, it just
 * shows colour chips / a font sample / a style chip. `styleKit` is `unknown` (a partial
 * kit interpreted by `kind`), so each extractor narrows defensively and returns null
 * when the shape is unexpected (the row still lists by name).
 */
export type ThemeSwatch =
  | { kind: "palette"; colors: string[]; background: string | null }
  | { kind: "font"; heading: string; body: string | null }
  | { kind: "style"; radiusPx: number | null; shadow: string | null };

export function extractSwatch(theme: BrowsableTheme): ThemeSwatch | null {
  const kit = theme.styleKit;
  if (!isRecord(kit)) {
    return null;
  }
  if (theme.kind === "palette") {
    return paletteSwatch(kit);
  }
  if (theme.kind === "font") {
    return fontSwatch(kit);
  }
  return styleSwatch(kit);
}

function paletteSwatch(kit: Record<string, unknown>): ThemeSwatch {
  const hues = Array.isArray(kit.accentHues) ? kit.accentHues : [];
  const colors = hues
    .map((hue) => (isRecord(hue) && typeof hue.base === "string" ? hue.base : null))
    .filter((base): base is string => base !== null)
    .slice(0, 5);
  const background =
    isRecord(kit.background) && typeof kit.background.css === "string" ? kit.background.css : null;
  return { kind: "palette", colors, background };
}

function fontSwatch(kit: Record<string, unknown>): ThemeSwatch {
  const fonts = isRecord(kit.fonts) ? kit.fonts : {};
  return {
    kind: "font",
    heading: typeof fonts.heading === "string" ? fonts.heading : "—",
    body: typeof fonts.body === "string" ? fonts.body : null
  };
}

function styleSwatch(kit: Record<string, unknown>): ThemeSwatch {
  const effects = isRecord(kit.effects) ? kit.effects : {};
  return {
    kind: "style",
    radiusPx: typeof effects.cardRadiusPx === "number" ? effects.cardRadiusPx : null,
    shadow: typeof effects.cardShadow === "string" ? effects.cardShadow : null
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
