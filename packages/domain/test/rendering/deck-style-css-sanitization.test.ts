import { describe, expect, it } from "vitest";
import { buildDeckStyleCss } from "@/rendering/deck-style-css";
import { defaultDesignStyleKit } from "@/design/default-design-style-kit";
import type { DesignSystem } from "@/design/design.types";

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
    layoutGrid: "16:9",
    slidePatterns: [],
    chartStyle: "minimal"
  };
}

describe("buildDeckStyleCss sanitization", () => {
  it("neutralizes a CSS-breakout palette colour from upstream (e.g. LLM)", () => {
    const css = buildDeckStyleCss(
      defaultDesignStyleKit(),
      designSystemWith({ accent: "red;} body{display:none} .x{" })
    );

    expect(css).not.toContain("body{display:none}");
    // The malicious value must not survive as a raw declaration value.
    expect(css).not.toContain("red;}");
    expect(css).not.toContain(".x{");
  });

  it("neutralizes breakout / url() in style-kit effect strings", () => {
    const malicious = defaultDesignStyleKit();
    const tampered = {
      ...malicious,
      effects: {
        ...malicious.effects,
        cardBorder: "1px solid red; } body { background: url(https://evil.example/x) ",
        cardShadow: "}</style><script>alert(1)</script>"
      }
    };

    const css = buildDeckStyleCss(tampered, designSystemWith({}));

    expect(css).not.toContain("url(https://evil.example");
    expect(css).not.toContain("</style>");
    expect(css).not.toContain("<script>");
    expect(css).not.toContain("body { background:");
  });

  it("passes valid curated values through unchanged", () => {
    const css = buildDeckStyleCss(defaultDesignStyleKit(), designSystemWith({}));
    expect(css).toContain("--type-title: clamp(");
    expect(css).toContain("@keyframes rise");
    expect(css).toContain("--accent: #FF6B6B");
  });
});
