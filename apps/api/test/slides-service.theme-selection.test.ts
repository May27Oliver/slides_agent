import { describe, expect, it } from "vitest";
import type { SelectableTheme, ThemeStore } from "@slides-agent/domain";
import { SlidesService } from "@/modules/slides/slides.service";

/**
 * 007 US1: theme selection is a mandatory design-stage step. SlidesService runs
 * the real selectTheme over the ThemeStore's candidates and supplies the styleKit
 * on every path (here the fallback path — no LLM ports — which previously had no
 * curated kit). The styleKit override is unconditional in the service, so the
 * LLM-success branch sets it the same way (the domain design-planner test proves
 * the planner itself no longer carries a styleKit).
 */

const request = {
  sourceContent: "Onboarding conversion 從 18% 提升到 25%",
  deckBrief: {
    purpose: "PM planning review",
    audience: "Product and engineering leads",
    styleDirection: "brutalist",
    language: "zh-TW"
  }
} as const;

const fontKit = (heading: string) => ({ fonts: { heading, body: '"Inter", sans-serif' } });
const paletteKit = (base: string) => ({
  accentHues: [{ name: "a", base, gradient: `linear-gradient(135deg, ${base}, ${base})` }],
  accentGradient: `linear-gradient(110deg, ${base}, ${base})`,
  background: { css: base },
  cardSurface: "rgba(255,255,255,.8)",
  cardBorder: `1px solid ${base}`
});
const structuralKit = {
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

const CANDIDATES: SelectableTheme[] = [
  { id: "font-00-sans", kind: "font", keywords: ["clean"], support: "full", styleKit: fontKit('"Inter"') },
  { id: "font-10-display", kind: "font", keywords: ["brutalist"], support: "full", styleKit: fontKit('"Archivo"') },
  { id: "palette-00-safe", kind: "palette", keywords: ["neutral"], support: "full", styleKit: paletteKit("#111") },
  { id: "palette-10-acid", kind: "palette", keywords: ["brutalist"], support: "full", styleKit: paletteKit("#CCFF00") },
  { id: "style-00-minimal", kind: "style", keywords: ["minimal"], support: "full", styleKit: { effects: { cardRadiusPx: 12, cardShadow: "none" }, motion: structuralKit.motion } },
  { id: "style-10-brutalism", kind: "style", keywords: ["brutalist"], support: "full", styleKit: structuralKit }
];

const storeReturning = (candidates: SelectableTheme[]): ThemeStore => ({
  listSelectable: async () => candidates
});

const serviceWith = (themeStore?: ThemeStore): SlidesService =>
  new SlidesService(undefined, undefined, undefined, undefined, themeStore);

describe("SlidesService theme selection (US1)", () => {
  it("applies the DB-selected named theme to styleKit and records the three axis ids", async () => {
    const response = await serviceWith(storeReturning(CANDIDATES)).generatePreview(request);

    expect(response.designPlanningResult.styleKit?.kitName).toBe(
      "style-10-brutalism+palette-10-acid+font-10-display"
    );
    expect(response.previewArtifact.generationSummary.selectedTheme).toEqual({
      style: "style-10-brutalism",
      palette: "palette-10-acid",
      font: "font-10-display",
      fallback: false
    });
  });

  it("selects different themes for different style directions (deterministic, brief-driven)", async () => {
    const minimalReq = {
      ...request,
      deckBrief: { ...request.deckBrief, styleDirection: "minimal" }
    };
    const response = await serviceWith(storeReturning(CANDIDATES)).generatePreview(minimalReq);
    expect(response.previewArtifact.generationSummary.selectedTheme?.style).toBe("style-00-minimal");
  });

  it("safely falls back to the default kit when the DB has no selectable themes", async () => {
    const response = await serviceWith(storeReturning([])).generatePreview(request);

    expect(response.designPlanningResult.styleKit?.kitName).toBe("default");
    expect(response.previewArtifact.generationSummary.selectedTheme).toEqual({
      style: null,
      palette: null,
      font: null,
      fallback: true
    });
  });

  it("does not throw when no ThemeStore is wired (treated as no candidates)", async () => {
    const response = await serviceWith(undefined).generatePreview(request);
    expect(response.previewArtifact.generationSummary.selectedTheme?.fallback).toBe(true);
  });
});
