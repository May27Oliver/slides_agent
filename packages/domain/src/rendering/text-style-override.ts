import type { SlideDeck, TextStyleOverride } from "@/deck/deck.types";

/** The three override-able text fields (kept for call-site clarity / future per-field rules). */
export type TextStyleField = "title" | "message" | "bullet";

// Fallback stack appended after an override family, matching the theme defaults so a
// font that fails to load (or a CJK glyph the family lacks) degrades gracefully.
// SINGLE quotes: this string lands inside a double-quoted HTML style="" attribute, so
// double quotes would break out. The contracts charset forbids quotes in family names.
const FONT_FALLBACK = `'Noto Sans TC', system-ui, -apple-system, sans-serif`;

/**
 * 015 (FR-007/FR-008): the SINGLE source of truth that turns a TextStyleOverride into
 * an inline style fragment. Used by the template renderer — which both the server save
 * path and the client live preview run — so style parity can never drift.
 *
 * Values are absolute (free color picker + px slider + font family): `sizePx` →
 * `font-size:<n>px`, `color` → `color:<hex>`, `fontFamily` → a quoted family + the
 * theme fallback stack. Absent fields emit nothing (the theme default applies).
 */
export function textStyleInlineStyle(
  override: TextStyleOverride | undefined,
  _field: TextStyleField
): string {
  if (!override) {
    return "";
  }
  const parts: string[] = [];
  if (typeof override.sizePx === "number" && Number.isFinite(override.sizePx)) {
    parts.push(`font-size:${override.sizePx}px`);
  }
  if (override.color) {
    parts.push(`color:${override.color}`);
  }
  if (override.fontFamily) {
    parts.push(`font-family:'${override.fontFamily}', ${FONT_FALLBACK}`);
  }
  return parts.join(";");
}

/** Every distinct `fontFamily` used by text style overrides across the deck (sorted). */
export function collectOverrideFontFamilies(deck: SlideDeck): string[] {
  const families = new Set<string>();
  for (const slide of deck.slides) {
    const overrides = slide.textStyleOverrides;
    if (!overrides) {
      continue;
    }
    for (const override of [overrides.title, overrides.message]) {
      if (override?.fontFamily) {
        families.add(override.fontFamily);
      }
    }
    for (const override of Object.values(overrides.outlineById ?? {})) {
      if (override?.fontFamily) {
        families.add(override.fontFamily);
      }
    }
  }
  return [...families].sort();
}

/**
 * 015: a Google Fonts stylesheet href that loads exactly the given families (a common
 * weight range), or null when none. Used by the renderer to load per-field override
 * fonts, and by the web to preview each family in its own face.
 */
export function buildOverrideFontsHref(families: readonly string[]): string | null {
  if (families.length === 0) {
    return null;
  }
  const query = families
    .map(
      (family) => `family=${encodeURIComponent(family).replace(/%20/g, "+")}:wght@400;500;600;700`
    )
    .join("&");
  return `https://fonts.googleapis.com/css2?${query}&display=swap`;
}
