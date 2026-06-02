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
      sourceSectionIds: string[];
    }>;
  };
}

async function loadDeckPlanner(): Promise<DeckPlannerModule> {
  return loadPendingModule<DeckPlannerModule>("@/deck/deck-planner");
}

describe("deck plan proposal", () => {
  it("creates deterministic source-order slides with opening, merge, and conditional closing", async () => {
    const { createDeckPlanProposal } = await loadDeckPlanner();
    const sourceSections = [
      { id: "section_goal_a", heading: "目標", text: "Onboarding conversion 從 18% 提升到 25%" },
      { id: "section_goal_b", heading: "目標", text: "客服首次回覆時間從 12 小時降到 4 小時" },
      { id: "section_decision", heading: "決策", text: "本階段只做 dashboard MVP" },
      { id: "section_risk", heading: "風險", text: "Design resource 只有 0.5 FTE" },
      { id: "section_limit", heading: "限制", text: "不新增付費第三方 BI 工具" },
      { id: "section_next", heading: "下一步", text: "Dashboard MVP 需在 2026-08-15 前完成" }
    ];

    const first = createDeckPlanProposal({
      sourceSections,
      sourceFacts: [],
      chartIntents: [],
      deckBrief: {
        purpose: "PM planning review",
        audience: "Product and engineering leads"
      }
    });
    const second = createDeckPlanProposal({
      sourceSections,
      sourceFacts: [],
      chartIntents: [],
      deckBrief: {
        purpose: "PM planning review",
        audience: "Product and engineering leads"
      }
    });

    expect(second).toEqual(first);
    expect(first.slides.length).toBeGreaterThanOrEqual(3);
    expect(first.slides.length).toBeLessThanOrEqual(8);
    expect(first.slides[0]?.slideKind).toBe("opening");
    expect(first.slides.at(-1)?.slideKind).toBe("closing");
    expect(first.slides.some((slide) => slide.sourceSectionIds.length > 1)).toBe(true);

    const plannedSourceOrder = first.slides
      .filter((slide) => slide.slideKind === "content")
      .flatMap((slide) => slide.sourceSectionIds);
    expect(plannedSourceOrder).toEqual(sourceSections.map((section) => section.id));
  });
});
