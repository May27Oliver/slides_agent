/**
 * 009: readonly result-evidence summary of the theme that `selectTheme` +
 * `composeKit` actually produced for a deck. It is a lossless projection of the
 * composed `DesignStyleKit` (plus the visual density the design planner chose),
 * surfaced in `generationSummary.selectedTheme` so the control panel can show the
 * applied palette / typography / structure without parsing HTML or CSS.
 *
 * This is presentation evidence only — it never feeds back into any decision.
 */

import type { VisualDensity } from "@/design/design.types";

/** A single accent swatch: human name + its base colour (gradient dropped). */
export interface SelectedThemeAccentHue {
  readonly name: string;
  readonly base: string;
}

/** The applied heading/body font families (load hints dropped). */
export interface SelectedThemeFonts {
  readonly heading: string;
  readonly body: string;
}

/**
 * Renderable structure/effect flags projected from the kit's `effects` and
 * `background`. `radiusPx` and `shadow` are ALWAYS present (every kit defines a
 * card radius and shadow). The B-grade effects (`backdropBlurPx`, `glow`,
 * `texture`, `animation`) are optional: absent means the kit does not apply that
 * effect, and the panel renders nothing for it (no fabrication).
 */
export interface SelectedThemeStructureFeatures {
  readonly radiusPx: number;
  readonly shadow: boolean;
  readonly backdropBlurPx?: number;
  readonly glow?: boolean;
  readonly texture?: "grain" | "noise" | "paper";
  readonly animation?: { readonly preset: "aurora" | "mesh"; readonly durationMs: number };
}

/** The three theme axes selectTheme chose; `null` means that axis fell back. */
export interface SelectedThemeIds {
  readonly style: string | null;
  readonly palette: string | null;
  readonly font: string | null;
}

export interface SelectedThemeSummary {
  readonly kitName: string;
  readonly ids: SelectedThemeIds;
  /** True when any axis had no candidate and fell back to the default kit. */
  readonly fallback: boolean;
  readonly accentHues: readonly SelectedThemeAccentHue[];
  readonly fonts: SelectedThemeFonts;
  readonly visualDensity?: VisualDensity;
  readonly structureFeatures: SelectedThemeStructureFeatures;
}
