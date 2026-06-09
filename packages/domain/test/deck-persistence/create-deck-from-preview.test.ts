import { describe, expect, it } from "vitest";
import { createDeckFromPreviewResult } from "@/deck-persistence/create-deck-from-preview";
import type { PreviewJobRequest, PreviewResult } from "@/preview-job/preview-job.types";

const request: PreviewJobRequest = {
  sourceContent: "raw source",
  deckBrief: { purpose: "p", audience: "a" },
  accountId: "user_owner"
};

const result: PreviewResult = {
  slideDeck: { title: "  Q2 Review  ", slides: [] },
  designPlanningResult: { designSystem: {} },
  previewArtifact: { html: "<html></html>", generationSummary: { slideCount: 3 } },
  chartIntents: [
    { id: "chart-0", title: "Revenue", sourceFacts: [], recommendedVisuals: [], rationale: "" }
  ]
};

describe("createDeckFromPreviewResult", () => {
  it("maps a preview result to a deck + first generation revision", () => {
    const deck = createDeckFromPreviewResult({
      accountId: "user_owner",
      request,
      result,
      sourceJobId: "preview_job_1"
    });

    expect(deck.accountId).toBe("user_owner");
    expect(deck.title).toBe("Q2 Review"); // trimmed
    expect(deck.status).toBe("ready");
    expect(deck.sourceContent).toBe("raw source");
    expect(deck.deckBrief).toEqual({ purpose: "p", audience: "a" });
    expect(deck.revision).toEqual({
      revision: 1,
      slideDeck: { title: "  Q2 Review  ", slides: [] },
      designPlan: { designSystem: {} },
      html: "<html></html>",
      generationSummary: { slideCount: 3 },
      chartIntents: [
        { id: "chart-0", title: "Revenue", sourceFacts: [], recommendedVisuals: [], rationale: "" }
      ],
      origin: "generation",
      sourceJobId: "preview_job_1"
    });
  });

  it("persists chart intents (010 C1) and nulls them when absent", () => {
    const withCharts = createDeckFromPreviewResult({
      accountId: "u",
      request,
      result,
      sourceJobId: "j"
    });
    expect(withCharts.revision.chartIntents).toEqual([
      { id: "chart-0", title: "Revenue", sourceFacts: [], recommendedVisuals: [], rationale: "" }
    ]);

    // Legacy / chart-less results that never carried chartIntents persist as null
    // (so the editor re-render degrades to the deterministic chart fallback).
    const withoutCharts = createDeckFromPreviewResult({
      accountId: "u",
      request,
      result: { slideDeck: {}, designPlanningResult: null, previewArtifact: {} },
      sourceJobId: "j"
    });
    expect(withoutCharts.revision.chartIntents).toBeNull();
  });

  it("falls back to a default title and nulls when shapes are missing", () => {
    const deck = createDeckFromPreviewResult({
      accountId: "u",
      request: { sourceContent: "x", deckBrief: { purpose: "p", audience: "a" } },
      result: { slideDeck: {}, designPlanningResult: null, previewArtifact: {} },
      sourceJobId: "j"
    });

    expect(deck.title).toBe("Untitled deck");
    expect(deck.revision.html).toBeNull();
    expect(deck.revision.designPlan).toBeNull();
    expect(deck.revision.generationSummary).toBeNull();
  });
});
