import { describe, expect, it, vi } from "vitest";
import type {
  DeckOutlinePlanningPort,
  DeckOutlineRefinement,
  DeckOutlineRefinementInput
} from "@/deck/deck-outline-planner.port";
import { LlmDeckOutlinePlanner } from "@/deck/llm-deck-outline-planner";
import type { SlideDeck, SourceSection } from "@/deck/deck.types";

const sourceSections: SourceSection[] = [
  {
    id: "section_intro",
    heading: "自我介紹",
    text: "我是王小明，有 6 年全端工程經驗，主導過會員登入與點數整合。",
    segmentationSource: "llm"
  }
];

const baselineDeck: SlideDeck = {
  id: "deck_001",
  title: "面試簡報",
  purpose: "面試",
  audience: "長官",
  slides: [
    {
      id: "slide_001",
      slideKind: "opening",
      type: "content",
      title: "自我介紹: 董事長、經理你們好，我是王小明。是一位有著六年經驗的全端工程師...",
      message: "面試",
      outline: [
        {
          text: "董事長、經理你們好，我是王小明。是一位有著六年經驗的全端工程師...",
          sourceTrace: ["section_intro"],
          emphasis: "main_point"
        }
      ],
      layout: "title-summary",
      layoutIntent: { priority: "message_first", density: "medium", emphasis: "narrative" },
      contentBlocks: [],
      sourceTrace: ["section_intro"],
      speakerNotesDraft: "自我介紹。"
    }
  ],
  reviewReport: {
    assumptions: [],
    omittedOrCompressedContent: [],
    uncertainClaims: [],
    chartingDecisions: [],
    humanReviewNotes: []
  }
};

const input: DeckOutlineRefinementInput = {
  deck: baselineDeck,
  sourceSections,
  deckBrief: { purpose: "面試", audience: "長官", language: "zh-TW" }
};

function portReturning(refinement: DeckOutlineRefinement): DeckOutlinePlanningPort {
  return { refineDeckOutline: vi.fn().mockResolvedValue(refinement) };
}

describe("LlmDeckOutlinePlanner", () => {
  it("returns the baseline deck unchanged when no port is configured", async () => {
    const planner = new LlmDeckOutlinePlanner();
    const result = await planner.plan(input);
    expect(result).toBe(baselineDeck);
  });

  it("merges a valid refinement into the deck (better title and bullets)", async () => {
    const planner = new LlmDeckOutlinePlanner({
      deckOutlinePlanningPort: portReturning({
        slides: [
          {
            id: "slide_001",
            title: "自我介紹：六年全端經驗",
            message: "用六年實戰經驗說明為何適合",
            bullets: ["我是王小明，累積 6 年全端工程經驗", "主導過會員登入與點數整合系統"]
          }
        ]
      })
    });

    const result = await planner.plan(input);
    const slide = result.slides[0]!;
    expect(slide.title).toBe("自我介紹：六年全端經驗");
    expect(slide.message).toBe("用六年實戰經驗說明為何適合");
    expect(slide.outline.map((item) => item.text)).toEqual([
      "我是王小明，累積 6 年全端工程經驗",
      "主導過會員登入與點數整合系統"
    ]);
    // non-outline fields preserved from baseline
    expect(slide.id).toBe("slide_001");
    expect(slide.layout).toBe("title-summary");
    expect(slide.speakerNotesDraft).toBe("自我介紹。");
    expect(slide.outline.every((item) => item.sourceTrace.length > 0)).toBe(true);
  });

  it("falls back to the baseline deck when refinement fails validation", async () => {
    const planner = new LlmDeckOutlinePlanner({
      deckOutlinePlanningPort: portReturning({
        slides: [
          {
            id: "slide_001",
            title: "自我介紹",
            message: "面試",
            bullets: ["轉換率高達 9999%"] // fabricated number -> invalid
          }
        ]
      })
    });

    const result = await planner.plan(input);
    expect(result).toBe(baselineDeck);
  });

  it("falls back to the baseline deck when the port throws", async () => {
    const planner = new LlmDeckOutlinePlanner({
      deckOutlinePlanningPort: {
        refineDeckOutline: vi.fn().mockRejectedValue(new Error("LLM down"))
      }
    });

    const result = await planner.plan(input);
    expect(result).toBe(baselineDeck);
  });
});
