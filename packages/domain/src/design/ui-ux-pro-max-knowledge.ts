/**
 * Source-value shapes for the UI/UX Pro Max font-pairing and palette knowledge
 * (data/typography.csv, data/colors.csv). 007 made the DB the single source of
 * truth: the hand-ported CURATED_* arrays were removed and their tuning folded
 * into the seeded 56/96 themes. These types stay because the dev-time CSV→seed
 * converter (US2) parses CSV rows into them, then expands via style-kit-engine.
 */

export interface CuratedFontPairing {
  id: string;
  /** Latin display family (Google Fonts). */
  headingFamily: string;
  /** Latin body family (Google Fonts). */
  bodyFamily: string;
  /** Weight axes to request, keyed by family. */
  weights: Record<string, string>;
  keywords: string[];
}

export interface CuratedPalette {
  id: string;
  primary: string;
  secondary: string;
  cta: string;
  background: string;
  text: string;
  border: string;
  /** Whether the background is dark (drives background composition). */
  dark: boolean;
  keywords: string[];
}
