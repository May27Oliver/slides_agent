import { describe, expect, it } from "vitest";
import { applyDeckEdit } from "@/deck-edit/apply-deck-edit";
import { renderTemplateDeckArtifact } from "@/rendering/html-deck-renderer";
import type { ChartIntent } from "@/content-core/chart-intent.types";
import type { GenerationSummary, Slide, SlideDeck } from "@/deck/deck.types";
import type { DeckRevision } from "@/deck-persistence/deck.types";
import type { SelectableTheme } from "@/design/theme.types";
import { renderingDeck, renderingDesignPlanningResult } from "../rendering/rendering-fixtures";

const selectedTheme = {
  kitName: "brief-directed-planning",
  fallback: false
} as unknown as GenerationSummary["selectedTheme"];

function baseRevision(overrides: Partial<DeckRevision> = {}): DeckRevision {
  return {
    revision: 3,
    slideDeck: renderingDeck,
    designPlan: renderingDesignPlanningResult,
    chartIntents: null,
    html: "<old/>",
    generationSummary: { slideCount: 1, renderedCharts: [], selectedTheme } as unknown,
    origin: "generation",
    sourceJobId: "job_1",
    ...overrides
  };
}

/** A copy of the rendering deck with one slide's title edited (a legal text edit). */
function editTitle(deck: SlideDeck, title: string): SlideDeck {
  return {
    ...deck,
    slides: deck.slides.map((slide, index) => (index === 0 ? { ...slide, title } : slide))
  };
}

describe("applyDeckEdit (010 US1)", () => {
  it("produces an origin=edit payload, reusing base designPlan, re-rendering html", () => {
    const base = baseRevision();
    const result = applyDeckEdit(base, editTitle(renderingDeck, "Edited goal title"));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.payload.origin).toBe("edit");
    expect(result.payload.sourceJobId).toBeNull();
    expect(result.payload.designPlan).toEqual(renderingDesignPlanningResult);
    expect(result.payload.html).toContain("Edited goal title");
    expect(result.payload.html).not.toBe(base.html);
    // generationSummary is recomputed from the merged deck.
    expect(result.payload.generationSummary.slideCount).toBe(1);
    expect(result.payload.slideDeck.slides[0]!.title).toBe("Edited goal title");
  });

  it("returns INVALID_EDIT when the merge rejects read-only tampering", () => {
    const tampered: SlideDeck = {
      ...renderingDeck,
      slides: renderingDeck.slides.map((slide) => ({ ...slide, type: "quote" as Slide["type"] }))
    };
    const result = applyDeckEdit(baseRevision(), tampered);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.rejection).toBe("INVALID_EDIT");
  });

  it("returns VALIDATION_FAILED for an empty deck", () => {
    const empty: SlideDeck = { ...renderingDeck, slides: [] };
    const result = applyDeckEdit(baseRevision(), empty);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.rejection).toBe("VALIDATION_FAILED");
  });

  it("runs synchronously with zero LLM/async calls", () => {
    // applyDeckEdit is a pure function — its return is a value, not a Promise.
    const result = applyDeckEdit(baseRevision(), editTitle(renderingDeck, "x"));
    expect(result).not.toBeInstanceOf(Promise);
  });

  // T002g — chart fidelity (SC-002a)
  describe("chart fidelity", () => {
    const chartIntents: ChartIntent[] = [
      {
        id: "chart_goal_metrics",
        title: "Goal metrics",
        sourceFacts: [
          {
            id: "fact_conversion",
            kind: "metric",
            value: "25%",
            sourceText: "Onboarding conversion 從 18% 提升到 25%"
          }
        ],
        recommendedVisuals: ["metric_card"],
        rationale: "Show the headline metric."
      }
    ];

    const chartDeck: SlideDeck = {
      ...renderingDeck,
      slides: renderingDeck.slides.map((slide) => ({
        ...slide,
        contentBlocks: [
          { kind: "chart_placeholder", content: {}, chartIntentId: "chart_goal_metrics" }
        ]
      }))
    };

    it("redraws charts identically from persisted chartIntents (zero LLM)", () => {
      const baseArtifact = renderTemplateDeckArtifact({
        deck: chartDeck,
        designPlanningResult: renderingDesignPlanningResult,
        chartIntents,
        selectedTheme
      });

      const base = baseRevision({ slideDeck: chartDeck, chartIntents });
      const result = applyDeckEdit(base, editTitle(chartDeck, "New chart slide title"));

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.payload.chartIntents).toEqual(chartIntents);
      // The chart drew (not a fallback) and matches the base render's chart evidence.
      expect(result.payload.generationSummary.renderedCharts).toEqual(
        baseArtifact.generationSummary.renderedCharts
      );
      expect(result.payload.generationSummary.renderedCharts.length).toBe(1);
    });

    it("legacy base (null chartIntents) discloses charts were not reproduced", () => {
      const base = baseRevision({ slideDeck: chartDeck, chartIntents: null });
      const result = applyDeckEdit(base, editTitle(chartDeck, "Legacy edit"));

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      // No persisted inputs → no chart drawn, but disclosed honestly (not silent).
      expect(result.payload.generationSummary.renderedCharts).toEqual([]);
      expect(result.payload.slideDeck.reviewReport.humanReviewNotes.join("\n")).toContain(
        "圖表未重現"
      );
    });
  });

  // T008 — 011 deterministic re-theme during an edit.
  describe("011 re-theme", () => {
    const motion = {
      slideTransitionMs: 0,
      slideEasing: "linear",
      entranceMs: 0,
      staggerStepMs: 0,
      microMs: 0,
      respectReducedMotion: true
    };
    const fontKit = (heading: string) => ({ fonts: { heading, body: '"Inter", sans-serif' } });
    const paletteKit = (base: string) => ({
      accentHues: [{ name: "a", base, gradient: `linear-gradient(135deg, ${base}, ${base})` }],
      accentGradient: `linear-gradient(110deg, ${base}, ${base})`,
      background: { css: base },
      cardSurface: "rgba(255,255,255,.8)",
      cardBorder: `1px solid ${base}`
    });
    const candidates: SelectableTheme[] = [
      { id: "font-b", kind: "font", keywords: [], support: "full", styleKit: fontKit('"Inter"') },
      {
        id: "palette-b",
        kind: "palette",
        keywords: [],
        support: "full",
        styleKit: paletteKit("#111")
      },
      {
        id: "palette-acid",
        kind: "palette",
        keywords: [],
        support: "full",
        styleKit: paletteKit("#CCFF00")
      },
      {
        id: "style-b",
        kind: "style",
        keywords: [],
        support: "full",
        styleKit: { effects: { cardRadiusPx: 8, cardShadow: "none" }, motion }
      }
    ];
    const themedSummary = {
      kitName: "style-b+palette-b+font-b",
      ids: { style: "style-b", palette: "palette-b", font: "font-b" },
      fallback: false,
      accentHues: [],
      fonts: { heading: "", body: "" },
      structureFeatures: { radiusPx: 8, shadow: false }
    } as unknown as GenerationSummary["selectedTheme"];
    const themedBase = (over: Partial<DeckRevision> = {}) =>
      baseRevision({
        generationSummary: {
          slideCount: 1,
          renderedCharts: [],
          themeSelectionWarnings: [],
          selectedTheme: themedSummary
        } as unknown as GenerationSummary,
        ...over
      });

    it("swaps only the styleKit for an overridden axis; text/structure kept, no warnings", () => {
      const result = applyDeckEdit(themedBase(), editTitle(renderingDeck, "Re-themed title"), {
        themeSelection: { paletteId: "palette-acid" },
        candidates
      });

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      // only palette changed; style/font keep the base.
      expect(result.payload.designPlan.styleKit?.kitName).toBe("style-b+palette-acid+font-b");
      expect(result.payload.generationSummary.selectedTheme.ids).toEqual({
        style: "style-b",
        palette: "palette-acid",
        font: "font-b"
      });
      expect(result.payload.generationSummary.themeSelectionWarnings).toEqual([]);
      // the edited text survives the re-theme (theme never touches content).
      expect(result.payload.slideDeck.slides[0]!.title).toBe("Re-themed title");
      expect(result.payload.origin).toBe("edit");
    });

    it("emits base_unresolved when a base axis id is no longer in the catalogue", () => {
      const base = themedBase({
        generationSummary: {
          slideCount: 1,
          renderedCharts: [],
          themeSelectionWarnings: [],
          selectedTheme: {
            ...themedSummary,
            ids: { style: "style-b", palette: "palette-gone", font: "font-b" }
          }
        } as unknown as GenerationSummary
      });

      const result = applyDeckEdit(base, editTitle(renderingDeck, "x"), {
        themeSelection: { fontId: "font-b" },
        candidates
      });

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.payload.generationSummary.selectedTheme.ids.palette).toBeNull();
      expect(result.payload.generationSummary.themeSelectionWarnings).toEqual([
        { axis: "palette", reason: "base_unresolved" }
      ]);
    });

    it("re-themes a legacy base whose summary has no axis ids (guards instead of crashing)", () => {
      // baseRevision()'s selectedTheme is the legacy {kitName, fallback} with no ids.
      const result = applyDeckEdit(baseRevision(), editTitle(renderingDeck, "x"), {
        themeSelection: { paletteId: "palette-acid" },
        candidates
      });

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      // the overridden axis resolves; the two missing base axes fall back honestly.
      expect(result.payload.generationSummary.selectedTheme.ids.palette).toBe("palette-acid");
      const reasons = result.payload.generationSummary.themeSelectionWarnings
        .map((w) => `${w.axis}:${w.reason}`)
        .sort();
      expect(reasons).toEqual(["font:base_unresolved", "style:base_unresolved"]);
    });

    it("with no themeSelection, reuses the base theme verbatim (010 behaviour)", () => {
      const result = applyDeckEdit(themedBase(), editTitle(renderingDeck, "y"));
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.payload.generationSummary.selectedTheme.ids).toEqual({
        style: "style-b",
        palette: "palette-b",
        font: "font-b"
      });
      expect(result.payload.generationSummary.themeSelectionWarnings).toEqual([]);
    });
  });
});
