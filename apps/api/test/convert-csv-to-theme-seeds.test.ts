import { describe, expect, it } from "vitest";
import { validateThemeSeeds } from "@/infra/db/seed-themes";
import {
  applyAuthoredStyleKit,
  assignIds,
  fontRowToSeed,
  isDarkHex,
  paletteRowToSeed,
  parseFontWeights,
  slugify,
  splitKeywords,
  styleRowToSeed
} from "../scripts/convert-csv-to-theme-seeds";

/**
 * 007 US2: the CSV→seed transforms. Pure row→ThemeSeed mapping (font/palette
 * auto-expanded to full kits; style emitted as a raw skeleton). Verified against
 * sample rows shaped like the real typography/colors/styles CSV headers.
 */

const fontRow = {
  No: "1",
  "Font Pairing Name": "Classic Elegant",
  Category: "Serif + Sans",
  "Heading Font": "Playfair Display",
  "Body Font": "Inter",
  "Mood/Style Keywords": "elegant, luxury, sophisticated, timeless",
  "Best For": "Luxury brands, fashion",
  "Google Fonts URL":
    "https://fonts.google.com/share?selection.family=Inter:wght@300;400;500;600;700|Playfair+Display:wght@400;500;600;700",
  "CSS Import": "@import url('...');",
  "Tailwind Config": "...",
  Notes: "High contrast elegant heading."
};

const paletteRow = {
  No: "1",
  "Product Type": "SaaS (General)",
  "Primary (Hex)": "#2563EB",
  "Secondary (Hex)": "#3B82F6",
  "CTA (Hex)": "#F97316",
  "Background (Hex)": "#F8FAFC",
  "Text (Hex)": "#1E293B",
  "Border (Hex)": "#E2E8F0",
  Notes: "Trust blue + orange CTA contrast"
};

const styleRow = {
  No: "1",
  "Style Category": "Minimalism & Swiss Style",
  Type: "General",
  Keywords: "Clean, simple, spacious, grid-based",
  "Best For": "Enterprise apps, dashboards",
  "Design System Variables": "--spacing: 2rem, --border-radius: 0px, --shadow: none"
};

describe("convert-csv-to-theme-seeds transforms (007 US2)", () => {
  it("slugify produces id-safe slugs", () => {
    expect(slugify("Minimalism & Swiss Style")).toBe("minimalism-swiss-style");
    expect(slugify("E-Ink / Paper")).toBe("e-ink-paper");
  });

  it("splitKeywords cleans, dedupes, lowercases and strips parens", () => {
    expect(splitKeywords("SaaS (General), Trust blue, trust blue")).toEqual(["saas", "trust blue"]);
  });

  it("parseFontWeights extracts family→weights from a Google Fonts URL", () => {
    const weights = parseFontWeights(fontRow["Google Fonts URL"]);
    expect(weights["Inter"]).toBe("300;400;500;600;700");
    expect(weights["Playfair Display"]).toBe("400;500;600;700");
  });

  it("isDarkHex distinguishes dark vs light backgrounds", () => {
    expect(isDarkHex("#0F172A")).toBe(true);
    expect(isDarkHex("#F8FAFC")).toBe(false);
  });

  it("fontRowToSeed builds a valid full font ThemeSeed", () => {
    const seed = fontRowToSeed(fontRow, "font-10-classic-elegant");
    expect(seed).toMatchObject({
      id: "font-10-classic-elegant",
      kind: "font",
      scope: "builtin",
      support: "full",
      appliesTo: "universal",
      name: "Classic Elegant"
    });
    const kit = seed.styleKit as {
      fonts: { heading: string; body: string; googleFontsHref?: string };
    };
    expect(kit.fonts.heading).toContain("Playfair Display");
    expect(kit.fonts.body).toContain("Inter");
    expect(kit.fonts.googleFontsHref).toContain("fonts.googleapis.com");
    expect(validateThemeSeeds([seed])).toEqual([]);
  });

  it("paletteRowToSeed builds a valid full palette ThemeSeed", () => {
    const seed = paletteRowToSeed(paletteRow, "palette-00-safe-default");
    expect(seed).toMatchObject({
      kind: "palette",
      scope: "builtin",
      support: "full",
      appliesTo: "universal"
    });
    const kit = seed.styleKit as {
      accentHues: unknown[];
      accentGradient: string;
      background: { css: string };
    };
    expect(kit.accentHues.length).toBeGreaterThan(0);
    expect(kit.accentGradient).toContain("#2563EB");
    expect(kit.background.css).toContain("#F8FAFC");
    expect(validateThemeSeeds([seed])).toEqual([]);
  });

  it("styleRowToSeed builds a valid raw skeleton ThemeSeed preserving the CSV original", () => {
    const seed = styleRowToSeed(styleRow, "style-00-minimalism");
    expect(seed).toMatchObject({
      kind: "style",
      scope: "builtin",
      support: "raw",
      appliesTo: "presentation"
    });
    const kit = seed.styleKit as { rawDesignSystemVariables: string };
    expect(kit.rawDesignSystemVariables).toContain("--border-radius: 0px");
    expect(validateThemeSeeds([seed])).toEqual([]);
  });

  it("applyAuthoredStyleKit upgrades an authored A-grade id to a valid full kit", () => {
    const raw = styleRowToSeed(styleRow, "style-00-minimalism");
    const upgraded = applyAuthoredStyleKit(raw);
    expect(upgraded.support).toBe("full");
    const kit = upgraded.styleKit as { effects: { cardRadiusPx: number }; motion: unknown };
    expect(kit.effects.cardRadiusPx).toBe(0);
    expect(kit.motion).toBeDefined();
    // The skeleton's CSV-derived keywords/name are preserved; only support+styleKit change.
    expect(upgraded.keywords).toEqual(raw.keywords);
    expect(validateThemeSeeds([upgraded])).toEqual([]);
  });

  it("applyAuthoredStyleKit leaves a non-authored style row as a raw skeleton", () => {
    const raw = styleRowToSeed(
      {
        "Style Category": "Cyberpunk UI",
        Keywords: "neon, glitch",
        "Design System Variables": "--x: 1"
      },
      "style-10-cyberpunk-ui"
    );
    expect(applyAuthoredStyleKit(raw)).toBe(raw);
    expect(applyAuthoredStyleKit(raw).support).toBe("raw");
  });

  it("assignIds gives the safe default the 00 id and others 10-slug, disambiguating collisions", () => {
    const rows = [
      { "Font Pairing Name": "Classic Elegant" },
      { "Font Pairing Name": "Modern Professional" },
      { "Font Pairing Name": "Classic Elegant" }
    ];
    const ids = assignIds(
      rows,
      "font",
      "font-00-sans-default",
      (row) => /modern professional/iu.test(row["Font Pairing Name"] ?? ""),
      (row) => row["Font Pairing Name"] ?? ""
    );
    expect(ids).toEqual([
      "font-10-classic-elegant",
      "font-00-sans-default",
      "font-10-classic-elegant-2"
    ]);
  });
});
