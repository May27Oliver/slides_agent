import { describe, expect, it } from "vitest";
import { applyDeckEdit } from "@slides-agent/domain";
import type {
  ApplyDeckEditOptions,
  DeckRevision,
  SelectableTheme,
  SlideDeck
} from "@slides-agent/domain";
import { renderLivePreview } from "@/features/deck-editor/live-preview-render";
import { EditableSlideDraft } from "@/features/deck-editor/editable-slide-draft";
import { fixtureRevision, fixtureSlideDeck } from "@/features/deck-editor/test-fixtures";

describe("renderLivePreview (010 US1, FR-005a parity)", () => {
  it("imports + runs the domain renderer in the browser env (T002 smoke)", () => {
    const result = renderLivePreview(fixtureRevision, fixtureSlideDeck);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.html).toContain("<!doctype html>");
  });

  // 016: slidesHtml (for the in-place preview patch) is the same markup embedded in html.
  it("returns slidesHtml that appears verbatim inside html (parity)", () => {
    const result = renderLivePreview(fixtureRevision, fixtureSlideDeck);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.slidesHtml.length).toBeGreaterThan(0);
    expect(result.html).toContain(result.slidesHtml);
  });

  it("is byte-identical to what the server would store (same applyDeckEdit)", () => {
    const working = EditableSlideDraft.fromRevision(1, fixtureSlideDeck)
      .setTitle("slide_001", "Edited preview title")
      .toRequest().slideDeck as SlideDeck;

    const client = renderLivePreview(fixtureRevision, working);
    // The server runs the identical use-case on the identical inputs.
    const server = applyDeckEdit(fixtureRevision as unknown as DeckRevision, working);

    expect(client.ok).toBe(true);
    expect(server.ok).toBe(true);
    if (!client.ok || !server.ok) return;
    expect(client.html).toBe(server.payload.html);
    expect(client.html).toContain("Edited preview title");
  });

  it("degrades softly (ok=false) on a rejected edit instead of throwing", () => {
    const empty: SlideDeck = { ...fixtureSlideDeck, slides: [] };
    const result = renderLivePreview(fixtureRevision, empty);
    expect(result.ok).toBe(false);
  });

  it("threads themeSelection + candidates through, matching the server re-theme (011 parity)", () => {
    const candidates: SelectableTheme[] = [
      {
        id: "palette-x",
        kind: "palette",
        keywords: [],
        support: "full",
        styleKit: {
          accentHues: [
            { name: "x", base: "#CCFF00", gradient: "linear-gradient(135deg,#CCFF00,#CCFF00)" }
          ],
          accentGradient: "linear-gradient(110deg,#CCFF00,#CCFF00)",
          background: { css: "#101010" },
          cardSurface: "rgba(255,255,255,.8)",
          cardBorder: "1px solid #CCFF00"
        }
      }
    ];
    const options: ApplyDeckEditOptions = {
      themeSelection: { paletteId: "palette-x" },
      candidates
    };

    const client = renderLivePreview(fixtureRevision, fixtureSlideDeck, options);
    const server = applyDeckEdit(
      fixtureRevision as unknown as DeckRevision,
      fixtureSlideDeck,
      options
    );

    expect(client.ok).toBe(true);
    expect(server.ok).toBe(true);
    if (!client.ok || !server.ok) return;
    // Same use-case + same theme options ⇒ identical re-themed html (parity).
    expect(client.html).toBe(server.payload.html);
  });

  // 014 (FR-014): chart operations flow through the SAME use-case → byte parity,
  // including the deterministic derived ids.
  describe("014 chartOperations parity", () => {
    const chartIntents = [
      {
        id: "chart_goal_metrics",
        title: "Goal metrics",
        sourceFacts: [
          {
            id: "fact_conversion",
            kind: "metric" as const,
            value: "25%",
            sourceText: "Onboarding conversion 從 18% 提升到 25%"
          }
        ],
        recommendedVisuals: ["metric_card" as const],
        rationale: "headline"
      }
    ];
    const chartDeck: SlideDeck = {
      ...fixtureSlideDeck,
      slides: fixtureSlideDeck.slides.map((slide) => ({
        ...slide,
        contentBlocks: [
          { kind: "chart_placeholder" as const, content: {}, chartIntentId: "chart_goal_metrics" }
        ]
      }))
    };
    const chartRevision = {
      ...fixtureRevision,
      slideDeck: chartDeck,
      chartIntents
    };

    it("renders the overridden visual and exposes the generation summary", () => {
      const options: ApplyDeckEditOptions = {
        chartOperations: [
          { op: "set_visual", chartIntentId: "chart_goal_metrics", visual: "table" }
        ]
      };
      const client = renderLivePreview(chartRevision, chartDeck, options);
      const server = applyDeckEdit(chartRevision as unknown as DeckRevision, chartDeck, options);

      expect(client.ok).toBe(true);
      expect(server.ok).toBe(true);
      if (!client.ok || !server.ok) return;
      expect(client.html).toBe(server.payload.html);
      expect(client.html).toContain('data-chart-visual="table"');
      // The preview exposes the same summary the server stores (notes/disclosures feed UI).
      expect(JSON.stringify(client.generationSummary)).toBe(
        JSON.stringify(server.payload.generationSummary)
      );
    });

    it("derived ids match the server byte-for-byte (deterministic minting)", () => {
      const options: ApplyDeckEditOptions = {
        chartOperations: [
          {
            op: "edit_data",
            chartIntentId: "chart_goal_metrics",
            points: [
              { kind: "original", sourceFactId: "fact_conversion" },
              { kind: "user", point: { label: "新指標", valueText: "42", unit: "%" } }
            ]
          }
        ]
      };
      const client = renderLivePreview(chartRevision, chartDeck, options);
      const server = applyDeckEdit(chartRevision as unknown as DeckRevision, chartDeck, options);

      expect(client.ok).toBe(true);
      expect(server.ok).toBe(true);
      if (!client.ok || !server.ok) return;
      expect(client.html).toBe(server.payload.html);
      expect(client.generationSummary?.userDataDisclosures).toEqual([
        {
          slideId: "slide_001",
          chartIntentId: "chart_goal_metrics",
          chartTitle: "Goal metrics",
          userPointCount: 1,
          totalPointCount: 2
        }
      ]);
    });

    it("an invalid operation degrades softly with the domain detail", () => {
      const result = renderLivePreview(chartRevision, chartDeck, {
        chartOperations: [{ op: "set_visual", chartIntentId: "nope", visual: "bar" }]
      });
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.reason).toContain("operations[0]");
    });
  });
});
