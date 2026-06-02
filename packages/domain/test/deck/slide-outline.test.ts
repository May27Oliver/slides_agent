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
      slideKind: "opening" | "content" | "closing";
      outline: Array<{ text: string; sourceTrace: string[]; emphasis: string }>;
    }>;
  };
}

async function loadDeckPlanner(): Promise<DeckPlannerModule> {
  return loadPendingModule<DeckPlannerModule>("@/deck/deck-planner");
}

describe("slide outline", () => {
  it("gives every planned slide a slideKind and source-grounded outline", async () => {
    const { createDeckPlanProposal } = await loadDeckPlanner();

    const proposal = createDeckPlanProposal({
      sourceSections: [
        { id: "section_goal", heading: "目標", text: "Onboarding conversion 從 18% 提升到 25%" },
        { id: "section_risk", heading: "風險", text: "Design resource 只有 0.5 FTE" }
      ],
      sourceFacts: [
        {
          id: "fact_conversion",
          kind: "metric",
          value: "18%",
          sourceText: "Onboarding conversion 從 18% 提升到 25%",
          sourceSectionId: "section_goal"
        },
        {
          id: "fact_resource",
          kind: "constraint",
          value: "0.5 FTE",
          sourceText: "Design resource 只有 0.5 FTE",
          sourceSectionId: "section_risk"
        }
      ],
      chartIntents: [{ id: "chart_conversion", sourceFacts: [] }],
      deckBrief: {
        purpose: "PM planning review",
        audience: "Product and engineering leads"
      }
    });

    for (const slide of proposal.slides) {
      expect(["opening", "content", "closing"]).toContain(slide.slideKind);
      expect(slide.outline.length).toBeGreaterThanOrEqual(1);

      for (const item of slide.outline) {
        expect(item.text.trim().length).toBeGreaterThan(0);
        expect(item.sourceTrace.length).toBeGreaterThan(0);
        expect(["main_point", "evidence", "risk", "decision", "action", "context"]).toContain(
          item.emphasis
        );
      }
    }
  });
});
