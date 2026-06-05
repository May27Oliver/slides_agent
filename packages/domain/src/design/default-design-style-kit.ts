import type { AccentHue, DesignStyleKit, TypeScaleToken } from "@/design/design-style-kit.types";

export interface DefaultDesignStyleKitInput {
  /** Primary accent colour (6-digit hex) taken from the design system palette. */
  accent?: string;
  /** Style direction from the deck brief (influences density, never source truth). */
  styleDirection?: string;
}

const GOOGLE_FONTS_HREF =
  "https://fonts.googleapis.com/css2?family=Noto+Sans+TC:wght@300;400;500;700;900&family=Poppins:wght@400;500;600;700;800&display=swap";

const HEADING_STACK = '"Poppins", "Noto Sans TC", system-ui, -apple-system, sans-serif';
const BODY_STACK = '"Noto Sans TC", "Poppins", system-ui, -apple-system, sans-serif';

const HEX_PATTERN = /^#[0-9a-fA-F]{6}$/u;

/**
 * Renders a TypeScaleToken to a CSS clamp() declaration value.
 * Shared by tests and the renderer so the contract stays single-sourced.
 *
 * The three size fields are coerced through Number.isFinite before interpolation:
 * unlike weight/lineHeight (sanitized at the call site via safeNumber), these are
 * embedded directly into the CSS, so a non-numeric DB/theme value would otherwise
 * break out of the declaration. This is the value-level CSS-injection guard for
 * the type scale (mirrors safeNumber in the renderer).
 */
export function clampFontSizeCss(token: TypeScaleToken): string {
  const min = Number.isFinite(token.min) ? token.min : 14;
  const preferredVw = Number.isFinite(token.preferredVw) ? token.preferredVw : 1.4;
  const max = Number.isFinite(token.max) ? token.max : 24;
  return `clamp(${min}px, ${preferredVw}vw, ${max}px)`;
}

/**
 * Builds the deterministic, reference-grade warm-professional style kit.
 *
 * This is the baseline visual identity used when no curated/LLM style kit is
 * supplied. L1 (curated UIUX Pro Max data) later swaps the palette and fonts for
 * skill-selected values, but the structure stays identical.
 */
export function defaultDesignStyleKit(input: DefaultDesignStyleKitInput = {}): DesignStyleKit {
  const accent = normalizeHex(input.accent) ?? "#FF6B6B";
  const accentHues = buildAccentHues(accent);
  const accentGradient = `linear-gradient(110deg, ${accentHues[0]?.base ?? accent} 0%, ${accentHues[1]?.base ?? "#FF9F43"} 55%, ${accentHues[2]?.base ?? "#FFC93C"} 100%)`;

  return {
    kitName: "warm-professional",
    fonts: {
      heading: HEADING_STACK,
      body: BODY_STACK,
      googleFontsHref: GOOGLE_FONTS_HREF
    },
    typeScale: {
      coverTitle: { min: 46, preferredVw: 6, max: 84, weight: 800, lineHeight: 1.05 },
      slideTitle: { min: 34, preferredVw: 4.4, max: 58, weight: 800, lineHeight: 1.1 },
      message: { min: 19, preferredVw: 1.9, max: 28, weight: 600, lineHeight: 1.5 },
      bullet: { min: 16, preferredVw: 1.25, max: 20, weight: 500, lineHeight: 1.6 },
      eyebrow: { min: 13, preferredVw: 0.9, max: 15, weight: 700, lineHeight: 1.2 },
      caption: { min: 12, preferredVw: 0.8, max: 14, weight: 600, lineHeight: 1.4 }
    },
    motion: {
      slideTransitionMs: 550,
      slideEasing: "cubic-bezier(.2, .7, .2, 1)",
      entranceMs: 600,
      staggerStepMs: 90,
      microMs: 220,
      respectReducedMotion: true
    },
    effects: {
      cardRadiusPx: 22,
      cardBorder: "1.5px solid rgba(253, 227, 208, .9)",
      cardShadow:
        "0 20px 60px -22px rgba(255, 107, 107, .35), 0 8px 20px -12px rgba(255, 159, 67, .25)",
      cardSurface: "rgba(255, 255, 255, .82)",
      accentGradient
    },
    background: {
      css: [
        "radial-gradient(1200px 800px at 10% 0%, #FFE8D6 0%, transparent 60%)",
        "radial-gradient(900px 700px at 100% 100%, #E0F7F4 0%, transparent 60%)",
        "radial-gradient(700px 500px at 50% 50%, #FFF6E0 0%, transparent 70%)",
        "#FFF8EE"
      ].join(", ")
    },
    accentHues,
    patternLayouts: [
      {
        pattern: "title-summary",
        layout: "cover",
        description: "Large eyebrow + oversized cover title + summary message hero."
      },
      {
        pattern: "content-summary",
        layout: "title-bullets",
        description: "Eyebrow + consistent title + message + bullet cards with accent ticks."
      },
      {
        pattern: "metric-comparison",
        layout: "metric-cards",
        description: "Title + message + grid of metric cards, each tinted with a rotating hue."
      },
      {
        pattern: "risk-matrix",
        layout: "matrix",
        description: "Title + two-column matrix of risk/mitigation cards."
      },
      {
        pattern: "action-summary",
        layout: "closing",
        description: "Closing eyebrow + title + prioritized action list with accent numbering."
      }
    ],
    antiPatterns: [
      "Do not use emoji as icons; use inline SVG icons.",
      "Do not let hover states shift layout; animate colour/opacity/shadow only.",
      "Do not mix per-slide title sizes; use the shared slideTitle token.",
      "Do not exceed the viewport; content must fit within one 16:9 frame without inner scrolling.",
      "Do not use low-contrast muted text; keep body text at WCAG AA or better."
    ]
  };
}

/**
 * Resolves the style kit for a design planning result: the curated/LLM kit when
 * present, otherwise a deterministic default seeded by the design system accent.
 */
export function resolveStyleKit(designPlanningResult: {
  styleKit?: DesignStyleKit;
  designSystem?: { palette?: { accent?: string } };
}): DesignStyleKit {
  if (designPlanningResult.styleKit) {
    return designPlanningResult.styleKit;
  }
  const accent = designPlanningResult.designSystem?.palette?.accent;
  return defaultDesignStyleKit(accent ? { accent } : {});
}

function buildAccentHues(primary: string): AccentHue[] {
  const palette: Array<{ name: string; base: string; pair: string }> = [
    { name: "coral", base: primary, pair: "#FF9F43" },
    { name: "orange", base: "#FF9F43", pair: "#FFC93C" },
    { name: "amber", base: "#FFC93C", pair: "#FF9F43" },
    { name: "mint", base: "#4ECDC4", pair: "#06B6A4" },
    { name: "sky", base: "#5BC0EB", pair: "#3B82F6" },
    { name: "lavender", base: "#A78BFA", pair: "#7C3AED" }
  ];

  return palette.map((entry) => ({
    name: entry.name,
    base: entry.base,
    gradient: `linear-gradient(135deg, ${entry.base}, ${entry.pair})`
  }));
}

function normalizeHex(value?: string): string | undefined {
  if (!value) {
    return undefined;
  }
  const trimmed = value.trim();
  return HEX_PATTERN.test(trimmed) ? trimmed : undefined;
}
