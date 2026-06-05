import { describe, expect, it } from "vitest";
import { selectDesignStyleKit } from "@/design/select-design-style-kit";

describe("selectDesignStyleKit (UIUX Pro Max curated selection)", () => {
  it("defaults an interview deck to a warm professional curated kit", () => {
    const kit = selectDesignStyleKit({ purpose: "面試", audience: "長官" });

    expect(kit.kitName).toMatch(/warm|professional/u);
    expect(kit.fonts.googleFontsHref).toMatch(/fonts\.googleapis\.com/u);
    expect(kit.fonts.heading).toMatch(/Poppins/u);
    // Curated kit must keep the structural contract intact.
    expect(kit.typeScale.slideTitle.max).toBeGreaterThan(0);
    expect(kit.patternLayouts.length).toBeGreaterThanOrEqual(5);
    expect(kit.accentHues.length).toBeGreaterThanOrEqual(4);
    for (const hue of kit.accentHues) {
      expect(hue.base).toMatch(/^#[0-9a-fA-F]{6}$/u);
    }
  });

  it("selects a playful curated kit when the brief is playful/creative", () => {
    const kit = selectDesignStyleKit({
      purpose: "產品發表",
      audience: "年輕用戶",
      styleDirection: "playful creative fun vibrant 活潑"
    });

    expect(kit.kitName).toMatch(/playful|creative/u);
    expect(kit.fonts.googleFontsHref).toMatch(/Fredoka|Nunito|Plus\+Jakarta/u);
  });

  it("selects a tech curated kit for tech/startup style direction", () => {
    const kit = selectDesignStyleKit({
      purpose: "Pitch deck",
      audience: "investors",
      styleDirection: "tech startup modern developer"
    });

    expect(kit.fonts.heading).toMatch(/Space Grotesk|Outfit|Lexend/u);
  });

  it.each([
    ["professional business corporate 商務", "saas-blue+modern-professional"],
    ["warm friendly approachable 暖 親切", "warm-coral+friendly-saas"],
    ["playful creative vibrant 活潑 創意", "creative-pink+playful-creative"],
    ["elegant luxury editorial 優雅 高級", "portfolio-ink+classic-elegant"],
    ["tech startup developer 科技", "saas-blue+tech-startup"],
    ["minimal geometric clean 簡潔", "portfolio-ink+geometric-modern"]
  ])("maps the UI style preset %j to a distinct curated kit", (styleDirection, expectedKit) => {
    const kit = selectDesignStyleKit({ purpose: "簡報", audience: "團隊", styleDirection });
    expect(kit.kitName).toBe(expectedKit);
  });

  it("renders the elegant preset with editorial gold accents and neutral cards", () => {
    const kit = selectDesignStyleKit({
      purpose: "簡報",
      audience: "長官",
      styleDirection: "elegant luxury editorial 優雅 高級"
    });

    expect(kit.kitName).toBe("portfolio-ink+classic-elegant");
    expect(kit.accentHues[2]?.base).toBe("#BFA46A");
    expect(kit.effects.cardRadiusPx).toBe(8);
    expect(kit.effects.cardBorder).toContain("rgba(228, 228, 231");
    expect(kit.effects.cardShadow).not.toContain("255, 107, 107");
  });

  it("embeds the chosen heading family in the Google Fonts href", () => {
    const kit = selectDesignStyleKit({ purpose: "面試", audience: "長官" });
    const headingFamily = kit.fonts.heading.replace(/^"([^"]+)".*/u, "$1").replace(/\s+/gu, "+");
    expect(kit.fonts.googleFontsHref).toContain(headingFamily);
    expect(kit.fonts.googleFontsHref).toContain("Noto+Sans+TC");
  });
});
