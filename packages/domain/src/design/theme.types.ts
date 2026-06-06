/**
 * Theme domain vocabulary (feature 007). Pure language — no SQL. The `themes`
 * table holds three selection axes distinguished by `kind`; each row's
 * `style_kit` is a *partial* DesignStyleKit for that kind, and `composeKit`
 * merges the three partials into a full kit. See
 * specs/007-design-theme-system/data-model.md.
 */

import type {
  AccentHue,
  DesignBackground,
  DesignFontFamily,
  DesignMotion,
  DesignTypeScale,
  PatternLayoutHint
} from "@/design/design-style-kit.types";
import type { DesignStyleKit } from "@/design/design-style-kit.types";

export type ThemeKind = "font" | "palette" | "style";
export type ThemeSupport = "full" | "partial" | "raw";
export type ThemeAppliesTo = "presentation" | "landing" | "dashboard" | "universal";

/** kind = "font" — sourced from typography.csv (57 rows). */
export interface FontStyleKit {
  readonly fonts: DesignFontFamily;
}

/** kind = "palette" — sourced from colors.csv (96 rows). */
export interface PaletteStyleKit {
  /** Ordered palette; index 0 is the primary accent. */
  readonly accentHues: readonly AccentHue[];
  readonly accentGradient: string;
  readonly background: DesignBackground;
  readonly cardSurface: string;
  readonly cardBorder: string;
}

/** Built-in structural overlays the engine owns; kept enum-only to avoid CSS/keyframe injection (DR-008). */
export interface BackgroundStructure {
  readonly textureOverlay?: "grain" | "noise" | "paper";
  readonly gradientAnimation?: { readonly preset: "aurora" | "mesh"; readonly durationMs: number };
  /** Engine-owned ambient depth: large soft accent-hue blobs filling negative space. */
  readonly ambient?: "blobs";
}

/** Partial effects an A/B-grade style row contributes (B-grade tokens optional). */
export interface StyleEffects {
  readonly cardRadiusPx: number;
  readonly cardShadow: string;
  /** B-grade: backdrop-filter blur radius in px. */
  readonly cardBackdropBlurPx?: number;
  /** B-grade: extra glow layered onto box-shadow. */
  readonly glow?: string;
}

/** kind = "style", support = full | partial — sourced from styles.csv (A/B grade). */
export interface StyleStyleKit {
  readonly effects: StyleEffects;
  readonly motion: DesignMotion;
  readonly typeScale?: Partial<DesignTypeScale>;
  readonly patternLayouts?: readonly PatternLayoutHint[];
  readonly antiPatterns?: readonly string[];
  readonly backgroundStructure?: BackgroundStructure;
}

/** kind = "style", support = raw — C-grade; selection excludes it, engine does not render. */
export interface RawStyleKit {
  readonly rawDesignSystemVariables: string;
}

/** The shape the adapter pulls from the DB and hands to the pure selector. */
export interface SelectableTheme {
  readonly id: string;
  readonly kind: ThemeKind;
  readonly keywords: readonly string[];
  readonly support: ThemeSupport;
  /** Partial kit, interpreted by composeKit according to `kind`. */
  readonly styleKit: unknown;
}

/** The composed result selectTheme returns: a full kit + the three chosen ids. */
export interface SelectedTheme {
  readonly styleKit: DesignStyleKit;
  readonly ids: {
    readonly style: string | null;
    readonly palette: string | null;
    readonly font: string | null;
  };
  /** true when any axis (or all) had no candidate and fell back to default. */
  readonly fallback: boolean;
}
