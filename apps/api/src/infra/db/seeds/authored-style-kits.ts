import type {
  DesignMotion,
  StyleStyleKit,
  ThemeAppliesTo,
  ThemeSupport,
  TypeScaleToken
} from "@slides-agent/domain";

/**
 * Hand-authored full `style` tokens (feature 007 US2 — T026; US3 — T031).
 *
 * The CSV→seed converter only produces a *raw skeleton* for style rows (it cannot
 * infer renderable structure from an arbitrary CSV design system). The A-grade
 * styles below are mapped by judgement to full StyleStyleKit tokens — radius,
 * shadow, and motion are the structural identity each style contributes to
 * `composeKit` (the dark/colour identity comes from the paired palette axis).
 *
 * This map is the single source of truth for those overrides: the converter
 * merges it over the skeleton, so re-running `db:convert-seeds` is non-destructive
 * and the authored tokens stay version-controlled and reviewable. US3 extends the
 * same map with B-grade entries (backdrop blur / glow / texture / animated
 * gradient) and flips those styles to `support: "full"`.
 *
 * Grounding: `.claude/skills/ui-ux-pro-max/data/styles.csv` "Effects & Animation"
 * and "Design System Variables" columns for each A-grade category.
 */

export interface AuthoredStyleKit {
  readonly support: ThemeSupport;
  readonly appliesTo?: ThemeAppliesTo;
  readonly styleKit: StyleStyleKit;
}

/** Reduced-motion-respecting base; per-style overrides spread on top. */
const BASE_MOTION: DesignMotion = {
  slideTransitionMs: 300,
  slideEasing: "cubic-bezier(.2, .7, .2, 1)",
  entranceMs: 380,
  staggerStepMs: 70,
  microMs: 200,
  respectReducedMotion: true
};

const motion = (overrides: Partial<DesignMotion>): DesignMotion => ({ ...BASE_MOTION, ...overrides });

const heading = (token: TypeScaleToken): TypeScaleToken => token;

export const AUTHORED_STYLE_KITS: Record<string, AuthoredStyleKit> = {
  // 00 — safe default. Swiss minimalism: flat, sharp, subtle.
  "style-00-minimalism": {
    support: "full",
    styleKit: {
      effects: { cardRadiusPx: 0, cardShadow: "none" },
      motion: motion({ slideTransitionMs: 240, entranceMs: 360, staggerStepMs: 60, microMs: 220 }),
      antiPatterns: [
        "Do not add decorative shadows or gradients; keep surfaces flat.",
        "Do not introduce more than one accent colour."
      ]
    }
  },

  "style-10-neumorphism": {
    support: "full",
    styleKit: {
      effects: {
        cardRadiusPx: 14,
        cardShadow: "-6px -6px 16px rgba(255,255,255,.7), 6px 6px 16px rgba(0,0,0,.15)"
      },
      motion: motion({ slideTransitionMs: 200, slideEasing: "ease", entranceMs: 300, staggerStepMs: 50, microMs: 150 }),
      antiPatterns: [
        "Do not use on data-dense or high-contrast-required screens (low contrast).",
        "Do not mix hard borders with the soft emboss."
      ]
    }
  },

  "style-10-brutalism": {
    support: "full",
    styleKit: {
      effects: { cardRadiusPx: 0, cardShadow: "8px 8px 0 rgba(0,0,0,1)" },
      motion: motion({ slideTransitionMs: 0, slideEasing: "linear", entranceMs: 0, staggerStepMs: 0, microMs: 0 }),
      typeScale: {
        coverTitle: heading({ min: 48, preferredVw: 6.2, max: 88, weight: 900, lineHeight: 1.0 }),
        slideTitle: heading({ min: 34, preferredVw: 4.4, max: 58, weight: 900, lineHeight: 1.05 })
      },
      antiPatterns: [
        "Do not soften corners or add smooth transitions.",
        "Do not use subtle low-contrast palettes."
      ]
    }
  },

  "style-10-vibrant-block-based": {
    support: "full",
    styleKit: {
      effects: { cardRadiusPx: 18, cardShadow: "0 18px 40px -16px rgba(0,0,0,.28)" },
      motion: motion({ slideTransitionMs: 300, slideEasing: "cubic-bezier(.2,.8,.2,1)", entranceMs: 420, staggerStepMs: 80, microMs: 240 }),
      antiPatterns: [
        "Do not crowd blocks; preserve large 48px+ gaps.",
        "Do not drop below 7:1 contrast on vibrant fills."
      ]
    }
  },

  "style-10-dark-mode-oled": {
    support: "full",
    styleKit: {
      effects: { cardRadiusPx: 12, cardShadow: "0 10px 30px -12px rgba(0,0,0,.6)" },
      motion: motion({ slideTransitionMs: 300, slideEasing: "ease", entranceMs: 380, staggerStepMs: 70, microMs: 200 }),
      antiPatterns: [
        "Do not emit large pure-white fills; keep white emission low.",
        "Do not rely on colour alone for focus; keep a visible focus ring."
      ]
    }
  },

  "style-10-claymorphism": {
    support: "full",
    styleKit: {
      effects: {
        cardRadiusPx: 20,
        cardShadow: "inset -2px -2px 8px rgba(0,0,0,.12), 6px 8px 16px rgba(0,0,0,.16)"
      },
      motion: motion({ slideTransitionMs: 260, slideEasing: "cubic-bezier(.34,1.56,.64,1)", entranceMs: 420, staggerStepMs: 80, microMs: 200 }),
      antiPatterns: [
        "Do not use hard lines; keep edges soft and puffy.",
        "Do not pair with harsh high-contrast palettes."
      ]
    }
  },

  "style-10-flat-design": {
    support: "full",
    styleKit: {
      effects: { cardRadiusPx: 2, cardShadow: "none" },
      motion: motion({ slideTransitionMs: 180, slideEasing: "ease", entranceMs: 280, staggerStepMs: 50, microMs: 160 }),
      antiPatterns: ["Do not add gradients or drop shadows.", "Do not use skeuomorphic textures."]
    }
  },

  "style-10-soft-ui-evolution": {
    support: "full",
    styleKit: {
      effects: { cardRadiusPx: 10, cardShadow: "0 12px 28px -16px rgba(15,23,42,.22)" },
      motion: motion({ slideTransitionMs: 260, entranceMs: 360, staggerStepMs: 70, microMs: 200 }),
      antiPatterns: [
        "Do not drop below WCAG AA contrast for the sake of softness.",
        "Do not deepen shadows into neumorphism's low-contrast emboss."
      ]
    }
  },

  "style-10-neubrutalism": {
    support: "full",
    styleKit: {
      effects: { cardRadiusPx: 0, cardShadow: "4px 4px 0 rgba(0,0,0,1)" },
      motion: motion({ slideTransitionMs: 120, slideEasing: "cubic-bezier(.2,.8,.2,1)", entranceMs: 200, staggerStepMs: 40, microMs: 120 }),
      typeScale: {
        slideTitle: heading({ min: 34, preferredVw: 4.4, max: 58, weight: 800, lineHeight: 1.05 })
      },
      antiPatterns: [
        "Do not round the corners or blur the shadow.",
        "Do not desaturate; keep high-saturation blocks."
      ]
    }
  },

  "style-10-organic-biophilic": {
    support: "full",
    styleKit: {
      effects: { cardRadiusPx: 24, cardShadow: "0 8px 32px rgba(0,0,0,.08)" },
      motion: motion({ slideTransitionMs: 520, slideEasing: "cubic-bezier(.22,.61,.36,1)", entranceMs: 560, staggerStepMs: 90, microMs: 240 }),
      antiPatterns: [
        "Do not use sharp geometric corners; favour organic curves.",
        "Do not use harsh neon palettes."
      ]
    }
  },

  "style-10-dimensional-layering": {
    support: "full",
    styleKit: {
      effects: { cardRadiusPx: 16, cardShadow: "0 10px 20px rgba(0,0,0,.10), 0 20px 40px rgba(0,0,0,.10)" },
      motion: motion({ slideTransitionMs: 480, entranceMs: 520, staggerStepMs: 100, microMs: 240 }),
      antiPatterns: [
        "Do not flatten the elevation hierarchy; preserve distinct z-levels.",
        "Do not animate layout-shifting parallax that ignores reduced-motion."
      ]
    }
  },

  "style-10-exaggerated-minimalism": {
    support: "full",
    styleKit: {
      effects: { cardRadiusPx: 0, cardShadow: "none" },
      motion: motion({ slideTransitionMs: 300, entranceMs: 420, staggerStepMs: 80, microMs: 220 }),
      typeScale: {
        coverTitle: heading({ min: 48, preferredVw: 10, max: 192, weight: 900, lineHeight: 0.95 }),
        slideTitle: heading({ min: 40, preferredVw: 6, max: 96, weight: 900, lineHeight: 1.0 })
      },
      antiPatterns: [
        "Do not fill the whitespace; oversized type needs room to breathe.",
        "Do not add more than one accent."
      ]
    }
  },

  "style-10-e-ink-paper": {
    support: "full",
    styleKit: {
      effects: { cardRadiusPx: 2, cardShadow: "none" },
      // Instant "page turn": no fades, no motion blur.
      motion: motion({ slideTransitionMs: 0, slideEasing: "linear", entranceMs: 0, staggerStepMs: 0, microMs: 0 }),
      antiPatterns: [
        "Do not use fades or motion blur; transitions are instant page turns.",
        "Do not use saturated colours; stay ink-on-paper."
      ]
    }
  },

  "style-10-nature-distilled": {
    support: "full",
    styleKit: {
      effects: { cardRadiusPx: 18, cardShadow: "0 14px 36px -18px rgba(80,70,50,.30)" },
      motion: motion({ slideTransitionMs: 480, slideEasing: "cubic-bezier(.16,1,.3,1)", entranceMs: 520, staggerStepMs: 90, microMs: 240 }),
      antiPatterns: [
        "Do not use cold neon palettes; stay in warm natural tones.",
        "Do not over-animate; keep motion gentle."
      ]
    }
  }
};
