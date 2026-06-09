import { describe, expect, it } from "vitest";
import { defaultDesignStyleKit } from "@/design/default-design-style-kit";
import type { DesignStyleKit } from "@/design/design-style-kit.types";
import type { SelectedTheme } from "@/design/theme.types";
import { projectSelectedThemeSummary } from "@/design/selected-theme-summary";

function selected(styleKit: DesignStyleKit, overrides: Partial<SelectedTheme> = {}): SelectedTheme {
  return {
    styleKit,
    ids: { style: "style-01-minimalism", palette: "palette-03-cobalt", font: "font-02-geist" },
    fallback: false,
    ...overrides
  };
}

describe("projectSelectedThemeSummary", () => {
  it("projects kitName, ids, fonts, and accent swatches losslessly", () => {
    const kit = defaultDesignStyleKit();

    const summary = projectSelectedThemeSummary(selected(kit), "medium");

    expect(summary.kitName).toBe(kit.kitName);
    expect(summary.ids).toEqual({
      style: "style-01-minimalism",
      palette: "palette-03-cobalt",
      font: "font-02-geist"
    });
    expect(summary.fonts).toEqual({ heading: kit.fonts.heading, body: kit.fonts.body });
    expect(summary.visualDensity).toBe("medium");
    // accentHues drops the gradient, keeps name + base.
    expect(summary.accentHues).toEqual(kit.accentHues.map((h) => ({ name: h.name, base: h.base })));
    expect(summary.accentHues.length).toBeGreaterThan(0);
  });

  it("projects structure features from an A-grade kit (radius + shadow, no B-effects)", () => {
    const summary = projectSelectedThemeSummary(selected(defaultDesignStyleKit()));

    expect(summary.structureFeatures.radiusPx).toBe(22);
    expect(summary.structureFeatures.shadow).toBe(true);
    // No B-grade effects on the default kit → those keys are absent, not fabricated.
    expect(summary.structureFeatures.backdropBlurPx).toBeUndefined();
    expect(summary.structureFeatures.glow).toBeUndefined();
    expect(summary.structureFeatures.texture).toBeUndefined();
    expect(summary.structureFeatures.animation).toBeUndefined();
    // visualDensity omitted when not provided.
    expect(summary.visualDensity).toBeUndefined();
  });

  it("projects B-grade effects (glow, backdrop blur, texture, animation) when present", () => {
    const base = defaultDesignStyleKit();
    const bGrade: DesignStyleKit = {
      ...base,
      effects: { ...base.effects, cardBackdropBlurPx: 24, glow: "0 0 40px rgba(0,0,0,.4)" },
      background: {
        ...base.background,
        textureOverlay: "grain",
        gradientAnimation: { preset: "aurora", durationMs: 18000 }
      }
    };

    const summary = projectSelectedThemeSummary(selected(bGrade));

    expect(summary.structureFeatures.backdropBlurPx).toBe(24);
    expect(summary.structureFeatures.glow).toBe(true);
    expect(summary.structureFeatures.texture).toBe("grain");
    expect(summary.structureFeatures.animation).toEqual({ preset: "aurora", durationMs: 18000 });
  });

  it("marks shadow false when the kit paints none", () => {
    const base = defaultDesignStyleKit();
    const flat: DesignStyleKit = { ...base, effects: { ...base.effects, cardShadow: "none" } };

    expect(projectSelectedThemeSummary(selected(flat)).structureFeatures.shadow).toBe(false);
  });

  it("sanitizes token values at the projection boundary (CSS-injection defence)", () => {
    const base = defaultDesignStyleKit();
    const tampered: DesignStyleKit = {
      ...base,
      fonts: {
        ...base.fonts,
        heading: "system-ui; } body { background: url(https://evil.test/x) }",
        body: "Inter"
      },
      accentHues: [
        { name: "evil", base: "red; background:url(http://evil)", gradient: "g" },
        { name: "ok", base: "#3366FF", gradient: "g" }
      ]
    };

    const summary = projectSelectedThemeSummary(selected(tampered));

    // Malicious font/hex are replaced with safe fallbacks; safe values pass through.
    expect(summary.fonts.heading).toBe("system-ui, sans-serif");
    expect(summary.fonts.body).toBe("Inter");
    expect(summary.accentHues[0]!.base).toBe("#FF6B6B");
    expect(summary.accentHues[1]!.base).toBe("#3366FF");
  });

  it("carries the fallback flag and null axis ids when an axis fell back", () => {
    const summary = projectSelectedThemeSummary(
      selected(defaultDesignStyleKit(), {
        ids: { style: null, palette: "palette-03-cobalt", font: null },
        fallback: true
      })
    );

    expect(summary.fallback).toBe(true);
    expect(summary.ids).toEqual({ style: null, palette: "palette-03-cobalt", font: null });
  });
});
