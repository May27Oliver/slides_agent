import { describe, expect, it } from "vitest";
import { defaultDesignStyleKit } from "@/design/default-design-style-kit";
import type { DesignStyleKit } from "@/design/design-style-kit.types";
import type { DesignSystem } from "@/design/design.types";
import { buildDeckStyleCss } from "@/rendering/deck-style-css";

function designSystemWith(palette: Partial<DesignSystem["palette"]>): DesignSystem {
  return {
    themeName: "test",
    palette: {
      background: "#FFF8EE",
      surface: "#ffffff",
      text: "#1F2937",
      mutedText: "#475569",
      accent: "#FF6B6B",
      warning: "#D97706",
      ...palette
    },
    typography: { headingFamily: "Inter", bodyFamily: "Inter", scale: "compact" },
    spacing: { unit: 8, slidePadding: 48, blockGap: 16 },
    visualDensity: "medium",
    slidePatterns: []
  };
}

function kitWithBackground(css: string): DesignStyleKit {
  const kit = defaultDesignStyleKit();
  return { ...kit, background: { ...kit.background, css } };
}

function cssVar(css: string, name: string): string {
  return new RegExp(`--${name}:\\s*([^;]+);`, "u").exec(css)?.[1]?.trim() ?? "";
}

// A translucent accent wash (the 007 palette style) sits over the page's white
// canvas; an opaque dark gradient paints a genuinely dark canvas.
const LIGHT_WASH = "radial-gradient(1200px 800px at 10% 0%, #0891B222 0%, transparent 60%)";
const DARK_FILL = "linear-gradient(180deg, #0F172A 0%, #111827 100%)";

describe("buildDeckStyleCss contrast safety net", () => {
  it("overrides unreadable light text from the design system on a light canvas", () => {
    // The exact bug: an LLM 'dark' design system (light text) paired with a light
    // 007 palette would render light-on-light. The guard must replace it.
    const css = buildDeckStyleCss(
      kitWithBackground(LIGHT_WASH),
      designSystemWith({ text: "#E5E7EB", mutedText: "#CBD5E1" })
    );
    expect(cssVar(css, "text")).not.toBe("#E5E7EB");
    expect(cssVar(css, "text").toUpperCase()).toBe("#1F2937");
  });

  it("keeps well-contrasted dark text on a light canvas unchanged", () => {
    const css = buildDeckStyleCss(
      kitWithBackground(LIGHT_WASH),
      designSystemWith({ text: "#1F2937" })
    );
    expect(cssVar(css, "text")).toBe("#1F2937");
  });

  it("keeps light text on a genuinely dark (opaque) canvas", () => {
    const css = buildDeckStyleCss(
      kitWithBackground(DARK_FILL),
      designSystemWith({ text: "#F8FAFC" })
    );
    expect(cssVar(css, "text")).toBe("#F8FAFC");
  });
});

describe("buildDeckStyleCss chart-feature bullets", () => {
  it("suppresses the closing-layout counter on chart-split support bullets", () => {
    const css = buildDeckStyleCss(defaultDesignStyleKit(), designSystemWith({}));
    // The closing layout numbers bullets via `content:counter(step)`; in the
    // chart-feature split right column that leaks a clipped number behind the dot,
    // so the chart-points override must blank the ::before content...
    expect(css).toContain('.chart-points .bullet::before{content:""');
    // ...and it must come AFTER the closing rule so equal-specificity order wins.
    expect(css.indexOf(".chart-points .bullet::before")).toBeGreaterThan(
      css.indexOf(".layout-closing .bullet::before")
    );
  });
});
