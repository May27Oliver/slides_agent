import { describe, expect, it } from "vitest";
import { composeKit } from "@/design/compose-kit";
import { defaultDesignStyleKit } from "@/design/default-design-style-kit";
import type { FontStyleKit, PaletteStyleKit, StyleStyleKit } from "@/design/theme.types";

const FONT: FontStyleKit = {
  fonts: { heading: '"Space Grotesk", sans-serif', body: '"Inter", sans-serif' }
};

const PALETTE: PaletteStyleKit = {
  accentHues: [
    { name: "violet", base: "#7C3AED", gradient: "linear-gradient(135deg, #7C3AED, #4F46E5)" }
  ],
  accentGradient: "linear-gradient(110deg, #7C3AED 0%, #4F46E5 100%)",
  background: { css: "#0B0B12" },
  cardSurface: "rgba(20, 20, 30, .7)",
  cardBorder: "1px solid rgba(124, 58, 237, .4)"
};

const STYLE: StyleStyleKit = {
  effects: {
    cardRadiusPx: 0,
    cardShadow: "4px 4px 0 #000",
    cardBackdropBlurPx: 12,
    glow: "0 0 24px #7C3AED"
  },
  motion: {
    slideTransitionMs: 0,
    slideEasing: "linear",
    entranceMs: 0,
    staggerStepMs: 0,
    microMs: 0,
    respectReducedMotion: true
  },
  typeScale: { coverTitle: { min: 60, preferredVw: 8, max: 120, weight: 900, lineHeight: 1 } },
  patternLayouts: [{ pattern: "title-summary", layout: "cover", description: "brutalist cover" }],
  antiPatterns: ["No soft shadows."],
  backgroundStructure: {
    textureOverlay: "grain",
    gradientAnimation: { preset: "aurora", durationMs: 8000 }
  }
};

describe("composeKit", () => {
  it("returns a complete, valid kit equal to default when no part is supplied", () => {
    expect(composeKit({})).toEqual(defaultDesignStyleKit());
  });

  it("applies the font part to fonts only", () => {
    const kit = composeKit({ font: FONT });
    expect(kit.fonts).toEqual(FONT.fonts);
    expect(kit.accentHues).toEqual(defaultDesignStyleKit().accentHues);
  });

  it("applies the palette part to colour fields", () => {
    const kit = composeKit({ palette: PALETTE });
    expect(kit.accentHues).toEqual(PALETTE.accentHues);
    expect(kit.effects.accentGradient).toBe(PALETTE.accentGradient);
    expect(kit.effects.cardSurface).toBe(PALETTE.cardSurface);
    expect(kit.effects.cardBorder).toBe(PALETTE.cardBorder);
    expect(kit.background.css).toBe(PALETTE.background.css);
  });

  it("applies the style part to structure + B-grade tokens, merging typeScale", () => {
    const kit = composeKit({ style: STYLE });
    expect(kit.effects.cardRadiusPx).toBe(0);
    expect(kit.effects.cardShadow).toBe("4px 4px 0 #000");
    expect(kit.effects.cardBackdropBlurPx).toBe(12);
    expect(kit.effects.glow).toBe("0 0 24px #7C3AED");
    expect(kit.motion.slideTransitionMs).toBe(0);
    expect(kit.background.textureOverlay).toBe("grain");
    expect(kit.background.gradientAnimation).toEqual({ preset: "aurora", durationMs: 8000 });
    // partial typeScale: provided role overridden, the rest stay default.
    expect(kit.typeScale.coverTitle.max).toBe(120);
    expect(kit.typeScale.slideTitle).toEqual(defaultDesignStyleKit().typeScale.slideTitle);
  });

  it("merges all three axes; colour and structure come from their own parts", () => {
    const kit = composeKit({ style: STYLE, palette: PALETTE, font: FONT });
    expect(kit.fonts).toEqual(FONT.fonts);
    expect(kit.accentHues).toEqual(PALETTE.accentHues);
    expect(kit.effects.cardRadiusPx).toBe(0); // from style
    expect(kit.effects.cardSurface).toBe(PALETTE.cardSurface); // from palette
    expect(kit.effects.glow).toBe("0 0 24px #7C3AED");
  });

  it("lets a style reclaim the card border (structural) over the palette's", () => {
    const framedStyle: StyleStyleKit = {
      effects: {
        cardRadiusPx: 0,
        cardShadow: "8px 8px 0 #141414",
        cardBorder: "3px solid #141414"
      },
      motion: STYLE.motion
    };
    const kit = composeKit({ style: framedStyle, palette: PALETTE, font: FONT });
    // The brutalist frame wins over the palette's soft border.
    expect(kit.effects.cardBorder).toBe("3px solid #141414");
    // ...but the rest of the colour axis still comes from the palette.
    expect(kit.effects.cardSurface).toBe(PALETTE.cardSurface);
  });

  it("keeps the palette border when the style does not set one", () => {
    const kit = composeKit({ style: STYLE, palette: PALETTE });
    expect(kit.effects.cardBorder).toBe(PALETTE.cardBorder);
  });

  it("omits B-grade tokens when the style part does not set them", () => {
    const plainStyle: StyleStyleKit = {
      effects: { cardRadiusPx: 8, cardShadow: "none" },
      motion: STYLE.motion
    };
    const kit = composeKit({ style: plainStyle });
    expect(kit.effects.cardBackdropBlurPx).toBeUndefined();
    expect(kit.effects.glow).toBeUndefined();
    expect(kit.background.textureOverlay).toBeUndefined();
    expect(kit.background.gradientAnimation).toBeUndefined();
  });
});
