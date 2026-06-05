import { describe, expect, it } from "vitest";
import { clampFontSizeCss, defaultDesignStyleKit } from "@/design/default-design-style-kit";

describe("defaultDesignStyleKit", () => {
  it("produces a reference-grade warm professional kit with Google Fonts", () => {
    const kit = defaultDesignStyleKit();

    expect(kit.kitName.length).toBeGreaterThan(0);
    expect(kit.fonts.googleFontsHref).toMatch(/fonts\.googleapis\.com/u);
    expect(kit.fonts.googleFontsHref).toMatch(/Noto\+Sans\+TC/u);
    expect(kit.fonts.googleFontsHref).toMatch(/Poppins/u);
    expect(kit.fonts.heading).toMatch(/Poppins|Noto Sans TC/u);
    expect(kit.fonts.body).toMatch(/Noto Sans TC/u);
  });

  it("defines one shared title token so every content slide title is the same size", () => {
    const kit = defaultDesignStyleKit();

    expect(kit.typeScale.slideTitle.max).toBeGreaterThan(kit.typeScale.message.max);
    expect(kit.typeScale.coverTitle.max).toBeGreaterThan(kit.typeScale.slideTitle.max);
    // A single slideTitle token is the contract that guarantees consistent
    // per-slide title sizing (the bug in the freeform LLM output).
    expect(clampFontSizeCss(kit.typeScale.slideTitle)).toMatch(/^clamp\(/u);
  });

  it("carries motion tokens that respect reduced motion", () => {
    const kit = defaultDesignStyleKit();

    expect(kit.motion.respectReducedMotion).toBe(true);
    expect(kit.motion.slideTransitionMs).toBeGreaterThan(0);
    expect(kit.motion.staggerStepMs).toBeGreaterThan(0);
    expect(kit.motion.slideEasing).toMatch(/cubic-bezier|ease/u);
  });

  it("provides a multi-hue accent palette and layered background for lively cards", () => {
    const kit = defaultDesignStyleKit();

    expect(kit.accentHues.length).toBeGreaterThanOrEqual(4);
    for (const hue of kit.accentHues) {
      expect(hue.base).toMatch(/^#[0-9a-fA-F]{6}$/u);
      expect(hue.gradient).toMatch(/gradient/u);
    }
    expect(kit.background.css).toMatch(/gradient/u);
  });

  it("maps every supported slide pattern to a concrete layout hint", () => {
    const kit = defaultDesignStyleKit();
    const patterns = kit.patternLayouts.map((entry) => entry.pattern);

    for (const pattern of [
      "title-summary",
      "content-summary",
      "metric-comparison",
      "risk-matrix",
      "action-summary"
    ]) {
      expect(patterns).toContain(pattern);
    }
  });

  it("derives the primary hue from a provided design system accent", () => {
    const kit = defaultDesignStyleKit({ accent: "#0EA5E9", styleDirection: "高密度 PM planning" });

    expect(kit.accentHues[0]?.base.toLowerCase()).toBe("#0ea5e9");
  });

  it("renders clamp font-size CSS from a type scale token", () => {
    expect(
      clampFontSizeCss({ min: 34, preferredVw: 4.4, max: 58, weight: 800, lineHeight: 1.1 })
    ).toBe("clamp(34px, 4.4vw, 58px)");
  });

  it("coerces non-finite type-scale sizes to safe numbers (no CSS breakout)", () => {
    // A malformed token (e.g. a string from untyped DB jsonb) must never be
    // interpolated raw into the clamp() — it would otherwise escape the rule.
    const malformed = {
      min: "0) } .evil {",
      preferredVw: Number.NaN,
      max: undefined,
      weight: 900,
      lineHeight: 1
    } as unknown as Parameters<typeof clampFontSizeCss>[0];
    const css = clampFontSizeCss(malformed);
    expect(css).toBe("clamp(14px, 1.4vw, 24px)");
    expect(css).not.toContain("}");
  });
});
