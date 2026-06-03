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
      title: string;
      message: string;
      outline: Array<{ text: string }>;
    }>;
  };
}

async function loadDeckPlanner(): Promise<DeckPlannerModule> {
  return loadPendingModule<DeckPlannerModule>("@/deck/deck-planner");
}

describe("deck plan source fidelity", () => {
  it("does not invent a closing slide for interview self-introduction content", async () => {
    const { createDeckPlanProposal } = await loadDeckPlanner();

    const proposal = createDeckPlanProposal({
      sourceSections: [
        {
          id: "section_intro",
          heading: "1. 自我介紹",
          text: "董事長、經理你們好，我是王小明。是一位有著六年經驗的全端工程師，過去幾年的工作經驗主要在品牌MES系統開發、跨系統整合，以及把複雜需求落地成可運作的產品功能。"
        }
      ],
      sourceFacts: [],
      chartIntents: [],
      deckBrief: {
        purpose: "面試",
        audience: "長官"
      }
    });

    expect(proposal.slides.map((slide) => slide.slideKind)).not.toContain("closing");
    expect(proposal.slides.map((slide) => slide.message)).not.toContain(
      "Close with only actions, owners, or deadlines stated in the source."
    );
  });

  it("strips markdown markers from planned titles and outline text", async () => {
    const { createDeckPlanProposal } = await loadDeckPlanner();

    const proposal = createDeckPlanProposal({
      sourceSections: [
        {
          id: "section_intro",
          heading: "## 1. 自我介紹",
          text: "- 董事長、經理你們好，我是王小明。"
        }
      ],
      sourceFacts: [],
      chartIntents: [],
      deckBrief: {
        purpose: "面試",
        audience: "長官"
      }
    });

    const renderedText = proposal.slides
      .flatMap((slide) => [slide.title, slide.message, ...slide.outline.map((item) => item.text)])
      .join("\n");

    expect(renderedText).not.toMatch(/^#+\s/mu);
    expect(renderedText).not.toContain("- 董事長");
  });
});
