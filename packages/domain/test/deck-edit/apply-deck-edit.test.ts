import { describe, expect, it } from "vitest";
import { applyDeckEdit } from "@/deck-edit/apply-deck-edit";
import { renderTemplateDeckArtifact } from "@/rendering/html-deck-renderer";
import type { ChartIntent } from "@/content-core/chart-intent.types";
import type { ChartOperation } from "@/deck-edit/chart-operation.types";
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

    it("legacy chart disclosure is synced, not duplicated on repeated edits", () => {
      const base = baseRevision({ slideDeck: chartDeck, chartIntents: null });
      const first = applyDeckEdit(base, editTitle(chartDeck, "Legacy edit 1"));
      expect(first.ok).toBe(true);
      if (!first.ok) return;

      const secondBase = baseRevision({
        revision: 4,
        slideDeck: first.payload.slideDeck,
        designPlan: first.payload.designPlan,
        chartIntents: null,
        generationSummary: first.payload.generationSummary,
        origin: "edit",
        sourceJobId: null
      });
      const second = applyDeckEdit(secondBase, editTitle(first.payload.slideDeck, "Legacy edit 2"));
      expect(second.ok).toBe(true);
      if (!second.ok) return;

      const legacyNotes = second.payload.slideDeck.reviewReport.humanReviewNotes.filter((line) =>
        line.includes("圖表未重現")
      );
      expect(legacyNotes).toHaveLength(1);
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

    it("treats an EMPTY themeSelection {} as a no-op identical to passing nothing (parity)", () => {
      // The editor live preview always forwards the current selection object (often {});
      // an empty selection must NOT re-theme, or the preview diverges from what save stores.
      const edited = editTitle(renderingDeck, "z");
      const withEmpty = applyDeckEdit(themedBase(), edited, { themeSelection: {}, candidates });
      const withNothing = applyDeckEdit(themedBase(), edited);

      expect(withEmpty.ok).toBe(true);
      expect(withNothing.ok).toBe(true);
      if (!withEmpty.ok || !withNothing.ok) return;
      expect(withEmpty.payload.html).toBe(withNothing.payload.html);
      expect(withEmpty.payload.generationSummary.themeSelectionWarnings).toEqual([]);
      expect(withEmpty.payload.generationSummary.selectedTheme.ids).toEqual({
        style: "style-b",
        palette: "palette-b",
        font: "font-b"
      });
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

  // T009 — 014 chart operations integration (data-model §5/§6/§6a/§10).
  describe("014 chart operations", () => {
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

    const EDIT_DATA_OP: ChartOperation = {
      op: "edit_data",
      chartIntentId: "chart_goal_metrics",
      points: [
        { kind: "original", sourceFactId: "fact_conversion" },
        { kind: "user", point: { label: "首次回覆", valueText: "4", unit: "小時" } }
      ]
    };

    it("(a) regression invariant: empty chartOperations ≡ none, except userDataDisclosures: []", () => {
      const base = baseRevision({ slideDeck: chartDeck, chartIntents });
      const edited = editTitle(chartDeck, "Edited with empty ops");
      const withEmpty = applyDeckEdit(base, edited, { chartOperations: [] });
      const withNone = applyDeckEdit(base, edited);

      expect(withEmpty.ok).toBe(true);
      expect(withNone.ok).toBe(true);
      if (!withEmpty.ok || !withNone.ok) return;
      expect(withEmpty.payload).toEqual(withNone.payload);
      expect(withEmpty.payload.html).toBe(withNone.payload.html);
      expect(withEmpty.payload.generationSummary.userDataDisclosures).toEqual([]);
      // reviewReport zero delta vs the base deck.
      expect(withEmpty.payload.slideDeck.reviewReport).toEqual(chartDeck.reviewReport);
    });

    it("(b) operations derive chartIntents/designPlan; the html reflects the new visual", () => {
      const base = baseRevision({ slideDeck: chartDeck, chartIntents });
      const result = applyDeckEdit(base, chartDeck, {
        chartOperations: [
          { op: "set_visual", chartIntentId: "chart_goal_metrics", visual: "table" }
        ]
      });

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      const plan = result.payload.designPlan.chartTreatmentPlans.find(
        (candidate) => candidate.chartIntentId === "chart_goal_metrics"
      );
      expect(plan?.visualOverride).toBe("table");
      expect(result.payload.html).toContain('data-chart-visual="table"');
    });

    it("(b2) invalid operations reject the whole request with INVALID_EDIT", () => {
      const base = baseRevision({ slideDeck: chartDeck, chartIntents });
      const result = applyDeckEdit(base, chartDeck, {
        chartOperations: [{ op: "set_visual", chartIntentId: "nope", visual: "table" }]
      });
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.rejection).toBe("INVALID_EDIT");
      expect(result.detail).toContain("operations[0]");
    });

    it("(b3) legacy base (null chartIntents) with non-empty operations is rejected", () => {
      const base = baseRevision({ slideDeck: chartDeck, chartIntents: null });
      const result = applyDeckEdit(base, chartDeck, { chartOperations: [EDIT_DATA_OP] });
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.rejection).toBe("INVALID_EDIT");
    });

    it("(c) userDataDisclosures: one entry per placement slide, [] without user data", () => {
      const secondSlide: Slide = {
        ...chartDeck.slides[0]!,
        id: "slide_002",
        title: "第二頁",
        message: "同一張圖再放一次"
      };
      const sharedDeck: SlideDeck = { ...chartDeck, slides: [chartDeck.slides[0]!, secondSlide] };
      const base = baseRevision({ slideDeck: sharedDeck, chartIntents });

      const result = applyDeckEdit(base, sharedDeck, { chartOperations: [EDIT_DATA_OP] });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.payload.generationSummary.userDataDisclosures).toEqual([
        {
          slideId: "slide_001",
          chartIntentId: "chart_goal_metrics",
          chartTitle: "Goal metrics",
          userPointCount: 1,
          totalPointCount: 2
        },
        {
          slideId: "slide_002",
          chartIntentId: "chart_goal_metrics",
          chartTitle: "Goal metrics",
          userPointCount: 1,
          totalPointCount: 2
        }
      ]);

      const noUserData = applyDeckEdit(base, sharedDeck, {
        chartOperations: [{ op: "set_visual", chartIntentId: "chart_goal_metrics", visual: "bar" }]
      });
      expect(noUserData.ok).toBe(true);
      if (!noUserData.ok) return;
      expect(noUserData.payload.generationSummary.userDataDisclosures).toEqual([]);
    });

    it("(d) reviewReport sync: disclosure note + chartingDecisions for user_data intents", () => {
      const base = baseRevision({ slideDeck: renderingDeck, chartIntents });
      const result = applyDeckEdit(base, renderingDeck, {
        chartOperations: [
          {
            op: "add_chart",
            slideId: "slide_001",
            source: {
              kind: "user_data",
              title: "手動圖表",
              visual: "bar",
              points: [
                { label: "A", valueText: "30", unit: "%" },
                { label: "B", valueText: "70", unit: "%" }
              ]
            }
          }
        ]
      });

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      const report = result.payload.slideDeck.reviewReport;
      expect(report.humanReviewNotes).toContain(
        "第 1 頁圖表「手動圖表」含使用者提供的數據點（2/2），非全數來自來源文件。"
      );
      const decision = report.chartingDecisions.find(
        (entry) => entry.chartIntentId === "chart_user_r3_0"
      );
      expect(decision).toBeDefined();
      expect(decision!.decision).toContain("使用者手動建立");
      expect(decision!.decision).toContain("bar");
      expect(decision!.sourceFacts).toEqual(["30%", "70%"]);
      expect(decision!.rationale).toBe("使用者於編輯器手動建立");

      // 無 user 數據 → reviewReport 零變化。
      const clean = applyDeckEdit(base, renderingDeck, {
        chartOperations: [{ op: "set_visual", chartIntentId: "chart_goal_metrics", visual: "bar" }]
      });
      expect(clean.ok).toBe(true);
      if (!clean.ok) return;
      expect(clean.payload.slideDeck.reviewReport).toEqual(renderingDeck.reviewReport);
    });

    it("(e) inheritance closure: re-editing a derived revision neither loses nor duplicates disclosures", () => {
      const base = baseRevision({ slideDeck: chartDeck, chartIntents });
      const first = applyDeckEdit(base, chartDeck, { chartOperations: [EDIT_DATA_OP] });
      expect(first.ok).toBe(true);
      if (!first.ok) return;

      const derivedBase = baseRevision({
        revision: 4,
        slideDeck: first.payload.slideDeck,
        designPlan: first.payload.designPlan,
        chartIntents: first.payload.chartIntents,
        generationSummary: first.payload.generationSummary,
        origin: "edit",
        sourceJobId: null
      });
      const second = applyDeckEdit(derivedBase, first.payload.slideDeck, { chartOperations: [] });
      expect(second.ok).toBe(true);
      if (!second.ok) return;
      // The chart still contains user data → the disclosure persists on re-edit.
      expect(second.payload.generationSummary.userDataDisclosures).toEqual(
        first.payload.generationSummary.userDataDisclosures
      );
      // The review note is synced, not appended again.
      const disclosureLines = second.payload.slideDeck.reviewReport.humanReviewNotes.filter(
        (line) => line.includes("含使用者提供的數據點")
      );
      expect(disclosureLines).toHaveLength(1);
    });

    it("(f) chart operations and 011 themeSelection coexist in one request", () => {
      const paletteAcid: SelectableTheme = {
        id: "palette-acid",
        kind: "palette",
        keywords: [],
        support: "full",
        styleKit: {
          accentHues: [
            { name: "a", base: "#CCFF00", gradient: "linear-gradient(135deg, #CCFF00, #CCFF00)" }
          ],
          accentGradient: "linear-gradient(110deg, #CCFF00, #CCFF00)",
          background: { css: "#CCFF00" },
          cardSurface: "rgba(255,255,255,.8)",
          cardBorder: "1px solid #CCFF00"
        }
      };
      const base = baseRevision({ slideDeck: chartDeck, chartIntents });
      const result = applyDeckEdit(base, chartDeck, {
        themeSelection: { paletteId: "palette-acid" },
        candidates: [paletteAcid],
        chartOperations: [
          { op: "set_visual", chartIntentId: "chart_goal_metrics", visual: "table" }
        ]
      });

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.payload.generationSummary.selectedTheme.ids.palette).toBe("palette-acid");
      expect(result.payload.html).toContain('data-chart-visual="table"');
    });
  });
});
