import { describe, expect, it } from "vitest";
import { loadPendingModule } from "../support/pending-module";

interface DeckPlannerModule {
  createDeckPlanProposal(input: {
    sourceSections: Array<{ id: string; heading: string; text: string }>;
    sourceFacts: Array<{
      id: string;
      kind: string;
      value: string;
      sourceText: string;
      sourceSectionId: string;
    }>;
    chartIntents: Array<{ id: string; sourceFacts: unknown[] }>;
    deckBrief: { purpose: string; audience: string };
  }): {
    slides: Array<{
      speakerNotesDraft: string;
      outline: Array<{ text: string; sourceTrace: string[] }>;
    }>;
  };
}

async function loadDeckPlanner(): Promise<DeckPlannerModule> {
  return loadPendingModule<DeckPlannerModule>("@/deck/deck-planner");
}

describe("speaker notes draft", () => {
  it("is required, short, conservative, and does not add unsupported claims", async () => {
    const { createDeckPlanProposal } = await loadDeckPlanner();

    const proposal = createDeckPlanProposal({
      sourceSections: [
        { id: "section_goal", heading: "目標", text: "Onboarding conversion 從 18% 提升到 25%" },
        { id: "section_limit", heading: "限制", text: "不處理 historical import" }
      ],
      sourceFacts: [],
      chartIntents: [],
      deckBrief: {
        purpose: "PM planning review",
        audience: "Product and engineering leads"
      }
    });

    for (const slide of proposal.slides) {
      expect(slide.speakerNotesDraft.trim().length).toBeGreaterThan(0);
      expect(slide.speakerNotesDraft.length).toBeLessThanOrEqual(400);
      expect(slide.speakerNotesDraft).not.toContain("已經達標");
      expect(slide.speakerNotesDraft).not.toContain("guaranteed");
      expect(slide.outline.length).toBeGreaterThan(0);
    }
  });
});
