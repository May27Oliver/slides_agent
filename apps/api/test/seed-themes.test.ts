import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { themes } from "@/infra/db/schema";
import {
  ThemeSeedValidationError,
  seedThemes,
  validateThemeSeeds,
  type ThemeSeed
} from "@/infra/db/seed-themes";
import { createTestDb, type TestDb } from "./helpers/pglite-db";

/**
 * 007 US2: builtin theme seeding. Idempotent upsert by id, and *all-or-nothing*
 * kind-aware validation — one invalid row rejects the whole batch with no writes.
 */

const fontSeed: ThemeSeed = {
  id: "font-00-sans-default",
  kind: "font",
  scope: "builtin",
  name: "Sans Default",
  keywords: ["clean", "neutral"],
  appliesTo: "universal",
  support: "full",
  styleKit: { fonts: { heading: '"Inter", sans-serif', body: '"Inter", sans-serif' } }
};

const paletteSeed: ThemeSeed = {
  id: "palette-00-safe-default",
  kind: "palette",
  scope: "builtin",
  name: "Safe Default",
  keywords: ["neutral"],
  appliesTo: "universal",
  support: "full",
  styleKit: {
    accentHues: [{ name: "ink", base: "#111111", gradient: "linear-gradient(135deg,#111,#333)" }],
    accentGradient: "linear-gradient(110deg,#111,#333)",
    background: { css: "#ffffff" },
    cardSurface: "rgba(255,255,255,.84)",
    cardBorder: "1px solid #111111"
  }
};

const styleFullSeed: ThemeSeed = {
  id: "style-00-minimalism",
  kind: "style",
  scope: "builtin",
  name: "Minimalism & Swiss",
  keywords: ["minimal", "swiss", "clean"],
  appliesTo: "presentation",
  support: "full",
  styleKit: {
    effects: { cardRadiusPx: 0, cardShadow: "none" },
    motion: {
      slideTransitionMs: 220,
      slideEasing: "ease",
      entranceMs: 300,
      staggerStepMs: 60,
      microMs: 160,
      respectReducedMotion: true
    }
  }
};

const styleRawSeed: ThemeSeed = {
  id: "style-10-bento-grids",
  kind: "style",
  scope: "builtin",
  name: "Bento Grids",
  keywords: ["bento", "grid"],
  appliesTo: "presentation",
  support: "raw",
  styleKit: { rawDesignSystemVariables: "--gap: 1rem; --radius: 16px;" }
};

const validBatch: ThemeSeed[] = [fontSeed, paletteSeed, styleFullSeed, styleRawSeed];

describe("seedThemes (007 US2)", () => {
  let testDb: TestDb;

  beforeEach(async () => {
    testDb = await createTestDb();
  });

  afterEach(async () => {
    await testDb.close();
  });

  it("upserts the batch and reports per-kind counts", async () => {
    const result = await seedThemes(testDb.db, validBatch);

    expect(result.total).toBe(4);
    expect(result.byKind).toEqual({ font: 1, palette: 1, style: 2 });

    const rows = await testDb.db.select().from(themes);
    expect(rows).toHaveLength(4);
    const minimal = rows.find((row) => row.id === "style-00-minimalism");
    expect(minimal?.kind).toBe("style");
    expect(minimal?.scope).toBe("builtin");
    expect(minimal?.active).toBe(true);
  });

  it("is idempotent: re-running does not duplicate rows and advances updatedAt on change", async () => {
    await seedThemes(testDb.db, validBatch);
    const [before] = await testDb.db
      .select()
      .from(themes)
      .where(eq(themes.id, "style-00-minimalism"));

    const renamed: ThemeSeed[] = validBatch.map((seed) =>
      seed.id === "style-00-minimalism" ? { ...seed, name: "Minimalism (renamed)" } : seed
    );
    await seedThemes(testDb.db, renamed);

    const rows = await testDb.db.select().from(themes);
    expect(rows).toHaveLength(4); // no duplicates

    const [after] = await testDb.db
      .select()
      .from(themes)
      .where(eq(themes.id, "style-00-minimalism"));
    expect(after?.name).toBe("Minimalism (renamed)");
    expect(after?.updatedAt?.getTime() ?? 0).toBeGreaterThanOrEqual(
      before?.updatedAt?.getTime() ?? 0
    );
  });

  it("rejects the whole batch and writes nothing when any row is invalid (all-or-nothing)", async () => {
    const badStyle: ThemeSeed = {
      ...styleFullSeed,
      id: "style-10-broken",
      // full style missing cardShadow + a non-numeric radius → invalid structural kit
      styleKit: { effects: { cardRadiusPx: "nope" }, motion: styleFullSeed.styleKit } as never
    };

    await expect(seedThemes(testDb.db, [fontSeed, badStyle, paletteSeed])).rejects.toBeInstanceOf(
      ThemeSeedValidationError
    );

    // Nothing was written — the good rows in the same batch did not slip through.
    const rows = await testDb.db.select().from(themes);
    expect(rows).toHaveLength(0);
  });

  it("reports every invalid row (not just the first) before any write", async () => {
    const badFont: ThemeSeed = {
      ...fontSeed,
      id: "font-10-broken",
      styleKit: { fonts: { heading: 42, body: "" } } as never
    };
    const badRaw: ThemeSeed = {
      ...styleRawSeed,
      id: "style-10-rawbroken",
      styleKit: { rawDesignSystemVariables: "" } as never
    };

    const issues = validateThemeSeeds([fontSeed, badFont, badRaw]);
    expect(issues.map((issue) => issue.id)).toEqual(["font-10-broken", "style-10-rawbroken"]);
    expect(issues[0]?.problems.length).toBeGreaterThan(0);
  });

  it("flags font/palette rows that are not support=full", async () => {
    const partialFont: ThemeSeed = { ...fontSeed, id: "font-10-partial", support: "partial" };
    const issues = validateThemeSeeds([partialFont]);
    expect(issues).toHaveLength(1);
    expect(issues[0]?.problems.some((p) => p.includes('support="full"'))).toBe(true);
  });

  it("flags an out-of-enum backgroundStructure value", async () => {
    const badStructure: ThemeSeed = {
      ...styleFullSeed,
      id: "style-10-badtexture",
      styleKit: {
        ...(styleFullSeed.styleKit as object),
        backgroundStructure: { textureOverlay: "sparkles" }
      } as never
    };
    const issues = validateThemeSeeds([badStructure]);
    expect(issues).toHaveLength(1);
    expect(issues[0]?.problems.some((p) => p.includes("textureOverlay"))).toBe(true);
  });

  it("accepts ambient:blobs and flags an out-of-enum ambient value", async () => {
    const ok: ThemeSeed = {
      ...styleFullSeed,
      id: "style-10-ambient-ok",
      styleKit: {
        ...(styleFullSeed.styleKit as object),
        backgroundStructure: { ambient: "blobs" }
      } as never
    };
    expect(validateThemeSeeds([ok])).toEqual([]);

    const bad: ThemeSeed = {
      ...styleFullSeed,
      id: "style-10-ambient-bad",
      styleKit: {
        ...(styleFullSeed.styleKit as object),
        backgroundStructure: { ambient: "sparkles" }
      } as never
    };
    const issues = validateThemeSeeds([bad]);
    expect(issues[0]?.problems.some((p) => p.includes("ambient"))).toBe(true);
  });

  it("rejects a CSS-breakout in a free-CSS string field (cardShadow / glow)", async () => {
    const breakout = "0 0 8px red } body { background: red"; // '}' escapes the rule
    const badShadow: ThemeSeed = {
      ...styleFullSeed,
      id: "style-10-cssbreakout",
      styleKit: {
        effects: { cardRadiusPx: 8, cardShadow: breakout },
        motion: (styleFullSeed.styleKit as { motion: unknown }).motion
      } as never
    };
    const shadowIssues = validateThemeSeeds([badShadow]);
    expect(shadowIssues[0]?.problems.some((p) => p.includes("cardShadow"))).toBe(true);

    const badGlow: ThemeSeed = {
      ...styleFullSeed,
      id: "style-10-glowbreakout",
      styleKit: {
        ...(styleFullSeed.styleKit as object),
        effects: {
          ...(styleFullSeed.styleKit as { effects: object }).effects,
          glow: "0 0 24px red; } .evil{}"
        }
      } as never
    };
    expect(validateThemeSeeds([badGlow])[0]?.problems.some((p) => p.includes("glow"))).toBe(true);
  });

  it("restricts googleFontsHref to fonts.googleapis.com", async () => {
    const evilHref: ThemeSeed = {
      ...fontSeed,
      id: "font-10-evil-href",
      styleKit: {
        fonts: {
          heading: '"Inter"',
          body: '"Inter"',
          googleFontsHref: "https://attacker.example/exfil.css"
        }
      } as never
    };
    const issues = validateThemeSeeds([evilHref]);
    expect(issues[0]?.problems.some((p) => p.includes("googleapis.com"))).toBe(true);

    // A legitimate Google Fonts href passes.
    const okHref: ThemeSeed = {
      ...fontSeed,
      id: "font-10-ok-href",
      styleKit: {
        fonts: {
          heading: '"Inter"',
          body: '"Inter"',
          googleFontsHref: "https://fonts.googleapis.com/css2?family=Inter&display=swap"
        }
      } as never
    };
    expect(validateThemeSeeds([okHref])).toEqual([]);
  });

  it("rejects a non-numeric typeScale size field (would reach clampFontSizeCss raw)", async () => {
    const badTypeScale: ThemeSeed = {
      ...styleFullSeed,
      id: "style-10-badtypescale",
      styleKit: {
        ...(styleFullSeed.styleKit as object),
        typeScale: {
          coverTitle: { min: "0) } .evil {", preferredVw: 6, max: 88, weight: 900, lineHeight: 1 }
        }
      } as never
    };
    const issues = validateThemeSeeds([badTypeScale]);
    expect(issues[0]?.problems.some((p) => p.includes("typeScale.coverTitle.min"))).toBe(true);
  });

  it("rejects an empty-string keyword (phantom-match guard)", async () => {
    const emptyKeyword: ThemeSeed = { ...fontSeed, id: "font-10-emptykw", keywords: ["clean", ""] };
    const issues = validateThemeSeeds([emptyKeyword]);
    expect(issues[0]?.problems.some((p) => p.includes("keywords"))).toBe(true);
  });

  it("accepts a B-grade style as support=full with engine tokens (007 US3)", async () => {
    // Glassmorphism-style row: backdrop blur + glow + animated gradient + texture
    // must all validate so selection can pick the upgraded B-grade theme.
    const bGrade: ThemeSeed = {
      id: "style-10-glass-bgrade",
      kind: "style",
      scope: "builtin",
      name: "Glass B-grade",
      keywords: ["frosted glass", "aurora"],
      appliesTo: "presentation",
      support: "full",
      styleKit: {
        effects: {
          cardRadiusPx: 16,
          cardShadow: "0 12px 40px -12px rgba(15,23,42,.35)",
          cardBackdropBlurPx: 18,
          glow: "0 0 28px rgba(255,0,170,.55)"
        },
        motion: styleFullSeed.styleKit.motion,
        backgroundStructure: {
          textureOverlay: "grain",
          gradientAnimation: { preset: "aurora", durationMs: 18000 }
        }
      } as ThemeSeed["styleKit"]
    };

    expect(validateThemeSeeds([bGrade])).toEqual([]);

    const result = await seedThemes(testDb.db, [bGrade]);
    expect(result.total).toBe(1);
    const [row] = await testDb.db
      .select()
      .from(themes)
      .where(eq(themes.id, "style-10-glass-bgrade"));
    expect(row?.support).toBe("full");
    expect(
      (row?.styleKit as { effects: { cardBackdropBlurPx?: number } }).effects.cardBackdropBlurPx
    ).toBe(18);
  });

  it("rejects a non-finite cardBackdropBlurPx (B-grade token sanitation)", async () => {
    const badBlur: ThemeSeed = {
      ...styleFullSeed,
      id: "style-10-badblur",
      styleKit: {
        ...(styleFullSeed.styleKit as object),
        effects: {
          ...(styleFullSeed.styleKit as { effects: object }).effects,
          cardBackdropBlurPx: "18px);}body{x"
        }
      } as never
    };
    const issues = validateThemeSeeds([badBlur]);
    expect(issues[0]?.problems.some((p) => p.includes("cardBackdropBlurPx"))).toBe(true);
  });
});
