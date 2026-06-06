import { describe, expect, it } from "vitest";
import { buildDeckStyleCss } from "@/rendering/deck-style-css";
import { defaultDesignStyleKit } from "@/design/default-design-style-kit";
import type { DesignStyleKit } from "@/design/design-style-kit.types";
import type { DesignSystem } from "@/design/design.types";

/**
 * 007 US3 (T028): the engine renders the four B-grade tokens — backdrop blur,
 * layered glow, built-in texture overlay, animated gradient — and every value is
 * sanitized (safeNumber/safeCssValue) or enum-owned so a tampered kit cannot
 * break out of the <style> block. Tokens are optional: absent => not emitted.
 */

const baseDesignSystem: DesignSystem = {
  themeName: "test",
  palette: {
    background: "#FFF8EE",
    surface: "#ffffff",
    text: "#1F2937",
    mutedText: "#475569",
    accent: "#FF6B6B",
    warning: "#D97706"
  },
  typography: { headingFamily: "Inter", bodyFamily: "Inter", scale: "compact" },
  spacing: { unit: 8, slidePadding: 48, blockGap: 16 },
  visualDensity: "medium",
  layoutGrid: "16:9",
  slidePatterns: [],
  chartStyle: "minimal"
};

function kitWith(overrides: {
  effects?: Partial<DesignStyleKit["effects"]>;
  background?: Partial<DesignStyleKit["background"]>;
}): DesignStyleKit {
  const base = defaultDesignStyleKit();
  return {
    ...base,
    effects: { ...base.effects, ...overrides.effects },
    background: { ...base.background, ...overrides.background }
  };
}

describe("buildDeckStyleCss B-grade tokens (007 US3)", () => {
  describe("cardBackdropBlurPx (Glassmorphism)", () => {
    it("emits a backdrop-filter blur when present", () => {
      const css = buildDeckStyleCss(
        kitWith({ effects: { cardBackdropBlurPx: 18 } }),
        baseDesignSystem
      );
      expect(css).toContain("--card-backdrop-blur: 18px");
      expect(css).toContain("backdrop-filter:blur(var(--card-backdrop-blur))");
    });

    it("omits backdrop-filter entirely when absent (default kit)", () => {
      const css = buildDeckStyleCss(defaultDesignStyleKit(), baseDesignSystem);
      expect(css).not.toContain("backdrop-filter");
    });

    it("coerces a non-finite blur to a safe number (no CSS breakout)", () => {
      const css = buildDeckStyleCss(
        kitWith({ effects: { cardBackdropBlurPx: "12px);}body{x" as unknown as number } }),
        baseDesignSystem
      );
      expect(css).not.toContain("body{x");
      expect(css).toMatch(/--card-backdrop-blur: \d+px/u);
    });
  });

  describe("glow (Y2K) layered onto card box-shadow", () => {
    it("appends a valid glow to the card shadow", () => {
      const css = buildDeckStyleCss(
        kitWith({ effects: { cardShadow: "0 8px 24px rgba(0,0,0,.2)", glow: "0 0 32px #FF00AA" } }),
        baseDesignSystem
      );
      const shadowLine = css.split("\n").find((line) => line.includes("--card-shadow:")) ?? "";
      expect(shadowLine).toContain("0 8px 24px rgba(0,0,0,.2)");
      expect(shadowLine).toContain("0 0 32px #FF00AA");
    });

    it("drops a breakout glow but keeps the base shadow intact", () => {
      const css = buildDeckStyleCss(
        kitWith({
          effects: { cardShadow: "0 8px 24px rgba(0,0,0,.2)", glow: "red } .evil { color:red" }
        }),
        baseDesignSystem
      );
      const shadowLine = css.split("\n").find((line) => line.includes("--card-shadow:")) ?? "";
      expect(shadowLine).toContain("0 8px 24px rgba(0,0,0,.2)");
      expect(css).not.toContain(".evil {");
      expect(css).not.toContain("} .evil");
      expect(shadowLine).not.toContain(".evil");
    });
  });

  describe("textureOverlay (E-Ink / Vintage Analog) — engine-owned enum", () => {
    it("renders a .deck::before texture layer for a known preset", () => {
      const css = buildDeckStyleCss(
        kitWith({ background: { textureOverlay: "paper" } }),
        baseDesignSystem
      );
      expect(css).toContain(".deck::before");
      expect(css).toContain("pointer-events:none");
    });

    it.each(["grain", "noise", "paper"] as const)(
      "renders an engine-owned texture for the %s preset",
      (preset) => {
        const css = buildDeckStyleCss(
          kitWith({ background: { textureOverlay: preset } }),
          baseDesignSystem
        );
        expect(css).toContain(".deck::before");
        // Engine-owned: only gradient functions, never raw url()/injection.
        expect(css).toMatch(/\.deck::before\{[\s\S]*gradient\(/u);
        expect(css).not.toContain("url(");
      }
    );

    it("omits the texture layer when absent", () => {
      const css = buildDeckStyleCss(defaultDesignStyleKit(), baseDesignSystem);
      expect(css).not.toContain(".deck::before");
    });

    it("ignores an out-of-enum texture value (no injection)", () => {
      const css = buildDeckStyleCss(
        kitWith({ background: { textureOverlay: "url(evil)" as unknown as "paper" } }),
        baseDesignSystem
      );
      expect(css).not.toContain(".deck::before");
      expect(css).not.toContain("url(evil)");
    });
  });

  describe("gradientAnimation (Aurora / Gradient Mesh) — reduced-motion guarded", () => {
    it("emits keyframes + an animated layer for a known preset", () => {
      const css = buildDeckStyleCss(
        kitWith({ background: { gradientAnimation: { preset: "aurora", durationMs: 12000 } } }),
        baseDesignSystem
      );
      expect(css).toContain("@keyframes deck-aurora");
      expect(css).toContain("12000ms");
      // The animated layer is anchored to .deck::after (z-index:-1) so it sits
      // behind slide content without depending on slides being transparent, and
      // it must not tile (no-repeat) or eat pointer events.
      expect(css).toContain(".deck::after");
      expect(css).toContain("background-repeat:no-repeat");
      expect(css).toContain("pointer-events:none");
      // .deck establishes a stacking context so ::after stays under content.
      expect(css).toMatch(/\.deck\{[^}]*z-index:0/u);
    });

    it("stays under the prefers-reduced-motion guard that disables all animation", () => {
      const css = buildDeckStyleCss(
        kitWith({ background: { gradientAnimation: { preset: "mesh", durationMs: 16000 } } }),
        baseDesignSystem
      );
      expect(css).toContain("@keyframes deck-mesh");
      // The global reduced-motion media query (already emitted) kills every animation.
      expect(css).toContain("@media (prefers-reduced-motion: reduce)");
      expect(css).toMatch(/prefers-reduced-motion: reduce\)\{[\s\S]*animation:none/u);
    });

    it("coerces a non-finite duration to a safe number", () => {
      const css = buildDeckStyleCss(
        kitWith({
          background: {
            gradientAnimation: { preset: "aurora", durationMs: "9s}body{x" as unknown as number }
          }
        }),
        baseDesignSystem
      );
      expect(css).not.toContain("body{x");
      expect(css).toMatch(/animation:deck-aurora \d+ms/u);
    });

    it("clamps an out-of-range duration (0ms would repaint every frame)", () => {
      const css = buildDeckStyleCss(
        kitWith({ background: { gradientAnimation: { preset: "aurora", durationMs: 0 } } }),
        baseDesignSystem
      );
      // 0ms is clamped up to the floor so the animation never busy-loops.
      expect(css).toContain("animation:deck-aurora 500ms");
    });

    it("ignores an out-of-enum preset (no injection)", () => {
      const css = buildDeckStyleCss(
        kitWith({
          background: {
            gradientAnimation: { preset: "evil{}" as unknown as "aurora", durationMs: 8000 }
          }
        }),
        baseDesignSystem
      );
      expect(css).not.toContain(".deck::after");
      expect(css).not.toContain("evil{}");
    });
  });

  describe("ambient blobs (organic depth) — fills negative space", () => {
    // Engine-owned blob positions (top-right, lower-right, bottom-left) that fill
    // the empty zones of the left-weighted layout.
    const BLOB_MARKER = "at 86% 14%";

    it("prepends soft accent-hue blob layers onto the body background when on", () => {
      const css = buildDeckStyleCss(
        kitWith({ background: { ambient: "blobs" } }),
        baseDesignSystem
      );
      const bodyBg =
        css.split("\n").find((line) => line.trimStart().startsWith("background:")) ?? "";
      expect(bodyBg).toContain(BLOB_MARKER);
      // Built from the palette accent hues as soft rgba (not raw hex), and still
      // layered over the original base background.
      expect(bodyBg).toMatch(/radial-gradient\([^)]*rgba\(/u);
      expect(bodyBg).toContain("transparent");
    });

    it("omits the blobs when absent (default kit)", () => {
      const css = buildDeckStyleCss(defaultDesignStyleKit(), baseDesignSystem);
      expect(css).not.toContain(BLOB_MARKER);
    });

    it("ignores an out-of-enum ambient value (no injection)", () => {
      const css = buildDeckStyleCss(
        kitWith({ background: { ambient: "}body{x" as unknown as "blobs" } }),
        baseDesignSystem
      );
      expect(css).not.toContain(BLOB_MARKER);
      expect(css).not.toContain("}body{x");
    });

    it("skips blobs entirely when every accent is neutral (no muddy grey wash)", () => {
      // A luxury/neutral palette whose accents are near-black/grey must NOT smear
      // the background into a dirty grey — those hues are skipped, leaving it clean.
      const base = defaultDesignStyleKit();
      const neutralKit: DesignStyleKit = {
        ...base,
        accentHues: [
          { name: "ink", base: "#1C1917", gradient: "linear-gradient(135deg,#1C1917,#44403C)" },
          { name: "taupe", base: "#44403C", gradient: "linear-gradient(135deg,#44403C,#1C1917)" }
        ],
        background: { ...base.background, ambient: "blobs" }
      };
      const css = buildDeckStyleCss(neutralKit, baseDesignSystem);
      expect(css).not.toContain(BLOB_MARKER);
    });

    it("colours blobs only from the colourful accents, skipping the neutral ones", () => {
      // Mixed palette (ink, taupe, gold): only the gold should tint a blob.
      const base = defaultDesignStyleKit();
      const mixedKit: DesignStyleKit = {
        ...base,
        accentHues: [
          { name: "ink", base: "#1C1917", gradient: "linear-gradient(135deg,#1C1917,#44403C)" },
          { name: "taupe", base: "#44403C", gradient: "linear-gradient(135deg,#44403C,#1C1917)" },
          { name: "gold", base: "#CA8A04", gradient: "linear-gradient(135deg,#CA8A04,#EAB308)" }
        ],
        background: { ...base.background, ambient: "blobs" }
      };
      const css = buildDeckStyleCss(mixedKit, baseDesignSystem);
      const bodyBg =
        css.split("\n").find((line) => line.trimStart().startsWith("background:")) ?? "";
      expect(bodyBg).toContain(BLOB_MARKER); // gold drives the blobs
      // The near-black ink accent must never appear as a blob colour.
      expect(bodyBg).not.toContain("rgba(28, 25, 23");
    });
  });
});
