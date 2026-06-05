/**
 * DesignStyleKit is the rich, concrete visual contract that lets reference-grade
 * design intent survive the design -> rendering boundary.
 *
 * The base DesignSystem only carries categorical hints (a single accent colour,
 * a "compact|standard|presentation" scale). That is too thin to express the
 * curated palettes, concrete type scale, motion, and effects that make a deck
 * look hand-crafted. The style kit is additive and optional: when absent, the
 * renderer falls back to defaultDesignStyleKit().
 *
 * All fields are readonly: a kit is built once (default or curated) and consumed
 * by the renderer/prompt without mutation, per the project's immutability rule.
 */

export interface TypeScaleToken {
  /** Lower bound of the CSS clamp(), in px. */
  readonly min: number;
  /** Preferred size as a viewport-width factor (the `Nvw` term). */
  readonly preferredVw: number;
  /** Upper bound of the CSS clamp(), in px. */
  readonly max: number;
  /** font-weight applied to this role. */
  readonly weight: number;
  /** line-height applied to this role. */
  readonly lineHeight: number;
}

export interface DesignTypeScale {
  readonly coverTitle: TypeScaleToken;
  /** Single shared token for every content-slide title => consistent sizing. */
  readonly slideTitle: TypeScaleToken;
  readonly message: TypeScaleToken;
  readonly bullet: TypeScaleToken;
  readonly eyebrow: TypeScaleToken;
  readonly caption: TypeScaleToken;
}

export interface DesignMotion {
  /** Enter/exit slide transition duration in ms. */
  readonly slideTransitionMs: number;
  /** Easing curve for slide transitions. */
  readonly slideEasing: string;
  /** Entrance ("rise") animation duration in ms. */
  readonly entranceMs: number;
  /** Per-item stagger step in ms for entrance choreography. */
  readonly staggerStepMs: number;
  /** Micro-interaction (hover) duration in ms. */
  readonly microMs: number;
  /** Whether the renderer must emit a prefers-reduced-motion guard. */
  readonly respectReducedMotion: boolean;
}

export interface DesignEffects {
  readonly cardRadiusPx: number;
  /** Full CSS `border` shorthand for cards. */
  readonly cardBorder: string;
  /** Full CSS `box-shadow` value (soft, tinted). */
  readonly cardShadow: string;
  /** Card surface background (usually a translucent white). */
  readonly cardSurface: string;
  /** Accent gradient used for highlights, bars, and chips. */
  readonly accentGradient: string;
  /**
   * 007 B-grade: backdrop-filter blur radius in px (Glassmorphism). Optional —
   * when absent the renderer emits no backdrop-filter. Sanitized via safeNumber.
   */
  readonly cardBackdropBlurPx?: number;
  /**
   * 007 B-grade: extra glow layered onto the card box-shadow (Y2K). Optional;
   * sanitized via safeCssValue/safeHex before interpolation.
   */
  readonly glow?: string;
}

export interface DesignFontFamily {
  /** CSS font-family stack for headings. */
  readonly heading: string;
  /** CSS font-family stack for body text. */
  readonly body: string;
  /** Optional Google Fonts stylesheet href (<link>). */
  readonly googleFontsHref?: string;
}

export interface AccentHue {
  /** Human label (e.g. "coral"). */
  readonly name: string;
  /** Solid base colour as a 6-digit hex. */
  readonly base: string;
  /** Full CSS gradient used to tint cards/metrics for this hue. */
  readonly gradient: string;
}

export interface DesignBackground {
  /** Full CSS `background` value (layered radial gradients + base). */
  readonly css: string;
  /**
   * 007 B-grade: built-in texture overlay applied at `.deck::before` (E-Ink,
   * Vintage Analog). Enum, not free CSS — the engine owns the actual layer so a
   * malicious value cannot inject CSS. Optional.
   */
  readonly textureOverlay?: "grain" | "noise" | "paper";
  /**
   * 007 B-grade: animated gradient background (Aurora, Gradient Mesh). Enum
   * preset + numeric duration; the engine emits the matching @keyframes guarded
   * by prefers-reduced-motion. Optional.
   */
  readonly gradientAnimation?: { readonly preset: "aurora" | "mesh"; readonly durationMs: number };
}

export interface PatternLayoutHint {
  /** Matches DesignSystem.slidePatterns / SlidePatternAssignment.primaryPattern. */
  readonly pattern: string;
  /** Renderer layout family: cover | title-bullets | metric-cards | matrix | closing. */
  readonly layout: string;
  /** Short human description of the intended composition. */
  readonly description: string;
}

export interface DesignStyleKit {
  readonly kitName: string;
  readonly fonts: DesignFontFamily;
  readonly typeScale: DesignTypeScale;
  readonly motion: DesignMotion;
  readonly effects: DesignEffects;
  readonly background: DesignBackground;
  /** Ordered multi-hue palette; index 0 is the primary accent. */
  readonly accentHues: readonly AccentHue[];
  readonly patternLayouts: readonly PatternLayoutHint[];
  /** Skill-sourced "do not do this" guidance (kept for prompt + review). */
  readonly antiPatterns: readonly string[];
}
