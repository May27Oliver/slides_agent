import { defaultDesignStyleKit } from "@/design/default-design-style-kit";
import type { AccentHue, DesignStyleKit } from "@/design/design-style-kit.types";
import {
  CURATED_FONT_PAIRINGS,
  CURATED_PALETTES,
  type CuratedFontPairing,
  type CuratedPalette
} from "@/design/ui-ux-pro-max-knowledge";

export interface SelectDesignStyleKitInput {
  purpose?: string;
  audience?: string;
  styleDirection?: string;
}

/**
 * Selects a concrete, curated DesignStyleKit by scoring the UI/UX Pro Max
 * font/palette knowledge against the deck brief. This is the in-process
 * equivalent of the skill's `search.py --design-system` selection step.
 */
export function selectDesignStyleKit(input: SelectDesignStyleKitInput): DesignStyleKit {
  // The explicit style direction dominates; purpose/audience only nudge so a
  // chosen style preset is never diluted by incidental words in those fields.
  const strong = (input.styleDirection ?? "").toLowerCase();
  const weak = [input.purpose, input.audience]
    .filter((value): value is string => Boolean(value))
    .join(" ")
    .toLowerCase();

  const pairing = pickBest(CURATED_FONT_PAIRINGS, strong, weak);
  const palette = pickBest(CURATED_PALETTES, strong, weak);

  const base = defaultDesignStyleKit({ accent: palette.primary });
  const accentHues = buildPaletteHues(palette);

  return {
    ...base,
    kitName: `${palette.id}+${pairing.id}`,
    fonts: {
      heading: `"${pairing.headingFamily}", "Noto Sans TC", system-ui, -apple-system, sans-serif`,
      body: `"${pairing.bodyFamily}", "Noto Sans TC", system-ui, -apple-system, sans-serif`,
      googleFontsHref: buildGoogleFontsHref(pairing)
    },
    accentHues,
    effects: {
      ...base.effects,
      accentGradient: `linear-gradient(110deg, ${palette.primary} 0%, ${palette.secondary} 55%, ${palette.cta} 100%)`
    },
    background: { css: buildBackground(palette) }
  };
}

const STRONG_WEIGHT = 3;
const WEAK_WEIGHT = 1;

function pickBest<T extends { keywords: string[] }>(
  entries: readonly [T, ...T[]],
  strong: string,
  weak: string
): T {
  // The non-empty tuple type guarantees entries[0] exists (index 0 wins ties).
  let best: T = entries[0];
  let bestScore = -1;
  for (const entry of entries) {
    const score = entry.keywords.reduce((total, keyword) => {
      const needle = keyword.toLowerCase();
      return (
        total +
        (strong.includes(needle) ? STRONG_WEIGHT : 0) +
        (weak.includes(needle) ? WEAK_WEIGHT : 0)
      );
    }, 0);
    if (score > bestScore) {
      best = entry;
      bestScore = score;
    }
  }
  return best;
}

function buildPaletteHues(palette: CuratedPalette): AccentHue[] {
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

function buildGoogleFontsHref(pairing: CuratedFontPairing): string {
  const families = Object.entries(pairing.weights).map(
    ([family, weights]) => `family=${encodeFamily(family)}:wght@${weights}`
  );
  families.push("family=Noto+Sans+TC:wght@300;400;500;700;900");
  return `https://fonts.googleapis.com/css2?${families.join("&")}&display=swap`;
}

function buildBackground(palette: CuratedPalette): string {
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
