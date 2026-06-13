import type { BrowsableTheme } from "@slides-agent/domain";

/**
 * 015: the selectable per-field font families, derived from the builtin font themes
 * (GET /api/themes → catalog.font). Each font theme's styleKit carries a CSS stack
 * whose LEADING quoted family is the real face (e.g. `"Playfair Display", "Noto Sans
 * TC", ...`); we pull those, de-dupe, and sort. ~90 families with no extra API.
 */
export function fontFamiliesFromCatalog(fontThemes: readonly BrowsableTheme[]): string[] {
  const families = new Set<string>();
  for (const theme of fontThemes) {
    const fonts = (theme.styleKit as { fonts?: { heading?: string; body?: string } } | null)
      ?.fonts;
    for (const stack of [fonts?.heading, fonts?.body]) {
      const family = leadingFamily(stack);
      if (family) {
        families.add(family);
      }
    }
  }
  return [...families].sort((a, b) => a.localeCompare(b));
}

/** The first quoted family in a CSS font stack, or null. */
function leadingFamily(stack: string | undefined): string | null {
  if (!stack) {
    return null;
  }
  const match = stack.match(/^\s*"([^"]+)"/u) ?? stack.match(/^\s*'([^']+)'/u);
  return match ? match[1]! : null;
}
