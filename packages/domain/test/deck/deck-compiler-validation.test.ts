import { describe, expect, it } from "vitest";
import { loadPendingModule } from "../support/pending-module";

interface DeckCompilerModule {
  compileDeckPlanProposal(input: {
    proposal: {
      id: string;
      title: string;
      slides: Array<{
        id: string;
        slideKind: "opening" | "content" | "closing";
        title: string;
        message: string;
        sourceSectionIds: string[];
        sourceFactIds: string[];
        chartIntentIds: string[];
        outline: Array<{ text: string; sourceTrace: string[]; emphasis: string }>;
        layoutIntent: { priority: string; density: string; emphasis: string };
        speakerNotesDraft: string;
        reviewNotes: string[];
      }>;
      planningNotes: string[];
    };
    sourceSections: Array<{ id: string }>;
    sourceFacts: Array<{ id: string }>;
    chartIntents: Array<{ id: string }>;
    deckBrief: { purpose: string; audience: string };
  }): { ok: true; slideDeck: unknown } | { ok: false; fallbackRequired: true; issues: string[] };
}

async function loadDeckCompiler(): Promise<DeckCompilerModule> {
  return loadPendingModule<DeckCompilerModule>("@/deck/deck-compiler");
}

describe("deck compiler validation", () => {
  it("rejects unknown source section, source fact, and chart intent references", async () => {
    const { compileDeckPlanProposal } = await loadDeckCompiler();

    const result = compileDeckPlanProposal({
      proposal: {
        id: "proposal_001",
        title: "Planning review",
        slides: [
          {
            id: "slide_001",
            slideKind: "content",
            title: "Unsupported references",
            message: "This slide references missing artifacts.",
            sourceSectionIds: ["missing_section"],
            sourceFactIds: ["missing_fact"],
            chartIntentIds: ["missing_chart"],
            outline: [
              {
                text: "Unsupported outline item.",
                sourceTrace: ["missing_section"],
                emphasis: "main_point"
              }
            ],
            layoutIntent: {
              priority: "message_first",
              density: "medium",
              emphasis: "narrative"
            },
            speakerNotesDraft: "Review the referenced planning detail.",
            reviewNotes: []
          }
        ],
        planningNotes: []
      },
      sourceSections: [{ id: "section_001" }],
      sourceFacts: [{ id: "fact_001" }],
      chartIntents: [{ id: "chart_001" }],
      deckBrief: {
        purpose: "PM planning review",
        audience: "Product and engineering leads"
      }
    });

    expect(result).toEqual({
      ok: false,
      fallbackRequired: true,
      issues: expect.arrayContaining([
        "Unknown source section reference: missing_section",
        "Unknown source fact reference: missing_fact",
        "Unknown chart intent reference: missing_chart"
      ])
    });
  });
});
