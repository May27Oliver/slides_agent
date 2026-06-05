import { describe, expect, it } from "vitest";
import { defaultDesignStyleKit } from "@/design/default-design-style-kit";
import { selectTheme } from "@/design/select-theme";
import type {
  FontStyleKit,
  PaletteStyleKit,
  SelectableTheme,
  StyleStyleKit
} from "@/design/theme.types";

const fontKit = (heading: string): FontStyleKit => ({
  fonts: { heading, body: '"Inter", sans-serif' }
});

const paletteKit = (base: string): PaletteStyleKit => ({
  accentHues: [{ name: "a", base, gradient: `linear-gradient(135deg, ${base}, ${base})` }],
  accentGradient: `linear-gradient(110deg, ${base}, ${base})`,
  background: { css: base },
  cardSurface: "rgba(255,255,255,.8)",
  cardBorder: `1px solid ${base}`
});

const styleKit: StyleStyleKit = {
  effects: { cardRadiusPx: 0, cardShadow: "4px 4px 0 #000" },
  motion: {
    slideTransitionMs: 0,
    slideEasing: "linear",
    entranceMs: 0,
    staggerStepMs: 0,
    microMs: 0,
    respectReducedMotion: true
  }
};

// Stable id order: `00` safe defaults first, then `10` variants.
const CANDIDATES: SelectableTheme[] = [
  {
    id: "font-00-sans-default",
    kind: "font",
    keywords: ["clean"],
    support: "full",
    styleKit: fontKit('"Inter"')
  },
  {
    id: "font-10-display",
    kind: "font",
    keywords: ["brutalist", "bold"],
    support: "full",
    styleKit: fontKit('"Archivo"')
  },
  {
    id: "palette-00-safe-default",
    kind: "palette",
    keywords: ["neutral"],
    support: "full",
    styleKit: paletteKit("#111111")
  },
  {
    id: "palette-10-violet",
    kind: "palette",
    keywords: ["brutalist", "vivid"],
    support: "full",
    styleKit: paletteKit("#7C3AED")
  },
  {
    id: "style-00-minimalism",
    kind: "style",
    keywords: ["minimal"],
    support: "full",
    styleKit: { effects: { cardRadiusPx: 12, cardShadow: "none" }, motion: styleKit.motion }
  },
  {
    id: "style-10-brutalism",
    kind: "style",
    keywords: ["brutalist", "raw"],
    support: "full",
    styleKit
  }
];

describe("selectTheme", () => {
  it("scores keywords per kind and picks the matching theme on each axis", () => {
    const selected = selectTheme({ styleDirection: "brutalist" }, CANDIDATES);
    expect(selected.ids).toEqual({
      style: "style-10-brutalism",
      palette: "palette-10-violet",
      font: "font-10-display"
    });
    expect(selected.fallback).toBe(false);
    expect(selected.styleKit.kitName).toBe("style-10-brutalism+palette-10-violet+font-10-display");
  });

  it("weights styleDirection above purpose/audience", () => {
    // 'brutalist' in the weak fields must not outrank a styleDirection match.
    const selected = selectTheme(
      { styleDirection: "minimal", purpose: "brutalist deck", audience: "brutalist team" },
      CANDIDATES
    );
    expect(selected.ids.style).toBe("style-00-minimalism");
  });

  it("lets a single styleDirection match dominate many purpose/audience matches", () => {
    // The flagged risk: weak-field accumulation must never overtake a strong match.
    // style-10-brutalism keeps both keywords ('brutalist','raw') hit by the weak
    // fields (2 weak), while style-00-minimalism gets a single styleDirection hit.
    const selected = selectTheme(
      {
        styleDirection: "minimal",
        purpose: "brutalist raw concrete",
        audience: "brutalist raw industrial team"
      },
      CANDIDATES
    );
    expect(selected.ids.style).toBe("style-00-minimalism");
  });

  it("falls back to the stably-ordered first candidate on no keyword match", () => {
    const selected = selectTheme({ styleDirection: "nonexistent-vibe" }, CANDIDATES);
    expect(selected.ids).toEqual({
      style: "style-00-minimalism",
      palette: "palette-00-safe-default",
      font: "font-00-sans-default"
    });
    // No-candidate fallback is distinct from no-match: all axes have a winner.
    expect(selected.fallback).toBe(false);
  });

  it("is deterministic for the same brief + candidate order", () => {
    const a = selectTheme({ styleDirection: "brutalist" }, CANDIDATES);
    const b = selectTheme({ styleDirection: "brutalist" }, CANDIDATES);
    expect(a).toEqual(b);
  });

  it("nulls an axis with no candidate and sets fallback, using default for that part", () => {
    const fontsOnly = CANDIDATES.filter((theme) => theme.kind === "font");
    const selected = selectTheme({ styleDirection: "brutalist" }, fontsOnly);
    expect(selected.ids.font).toBe("font-10-display");
    expect(selected.ids.style).toBeNull();
    expect(selected.ids.palette).toBeNull();
    expect(selected.fallback).toBe(true);
    // The missing axes keep the default kit's values.
    expect(selected.styleKit.accentHues).toEqual(defaultDesignStyleKit().accentHues);
  });

  it("returns the full default kit when there are no candidates at all", () => {
    const selected = selectTheme({ styleDirection: "brutalist" }, []);
    expect(selected.ids).toEqual({ style: null, palette: null, font: null });
    expect(selected.fallback).toBe(true);
    expect(selected.styleKit).toEqual({ ...defaultDesignStyleKit(), kitName: "default" });
  });

  it("excludes raw style rows from selection", () => {
    const withRaw: SelectableTheme[] = [
      {
        id: "style-10-bento",
        kind: "style",
        keywords: ["brutalist"],
        support: "raw",
        styleKit: { rawDesignSystemVariables: "x" }
      },
      ...CANDIDATES
    ];
    const selected = selectTheme({ styleDirection: "brutalist" }, withRaw);
    expect(selected.ids.style).toBe("style-10-brutalism");
  });
});
