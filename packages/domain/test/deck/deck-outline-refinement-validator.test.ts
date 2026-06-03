import { describe, expect, it } from "vitest";
import type {
  DeckOutlineRefinement,
  DeckOutlineRefinementInput
} from "@/deck/deck-outline-planner.port";
import { validateDeckOutlineRefinement } from "@/deck/deck-outline-refinement-validator";
import type { SlideDeck, SourceSection } from "@/deck/deck.types";

const sourceSections: SourceSection[] = [
  {
    id: "section_intro",
    heading: "自我介紹",
    text: "我是王小明，有 6 年全端工程經驗，主導過ERP和SAP專案。",
    segmentationSource: "llm"
  },
  {
    id: "section_goal",
    heading: "目標",
    text: "希望把轉換率從 18% 提升到 25%。",
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
      title: "自我介紹",
      message: "面試",
      outline: [{ text: "我是王小明", sourceTrace: ["section_intro"], emphasis: "main_point" }],
      layout: "title-summary",
      layoutIntent: { priority: "message_first", density: "medium", emphasis: "narrative" },
      contentBlocks: [],
      sourceTrace: ["section_intro"],
      speakerNotesDraft: "自我介紹。"
    },
    {
      id: "slide_002",
      slideKind: "content",
      type: "metrics",
      title: "目標",
      message: "目標",
      outline: [{ text: "提升轉換率", sourceTrace: ["section_goal"], emphasis: "evidence" }],
      layout: "content-summary",
      layoutIntent: { priority: "metrics_first", density: "high", emphasis: "numbers" },
      contentBlocks: [],
      sourceTrace: ["section_goal"],
      speakerNotesDraft: "目標。"
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

function refinement(overrides: Partial<DeckOutlineRefinement> = {}): DeckOutlineRefinement {
  return {
    slides: [
      {
        id: "slide_001",
        title: "自我介紹：六年全端經驗",
        message: "用六年實戰經驗回應為何適合這個職位",
        bullets: ["我是王小明，累積 6 年全端工程經驗", "主導過ERP和SAP專案"]
      },
      {
        id: "slide_002",
        title: "目標：提升轉換率",
        message: "把核心轉換指標往上推",
        bullets: ["希望把轉換率從 18% 提升到 25%"]
      }
    ],
    ...overrides
  };
}

describe("deck outline refinement validator", () => {
  it("accepts source-faithful, non-truncated refinement", () => {
    const result = validateDeckOutlineRefinement(input, refinement());
    expect(result.ok).toBe(true);
    expect(result.issues).toEqual([]);
  });

  it("rejects slide id mismatch or reorder", () => {
    const result = validateDeckOutlineRefinement(input, {
      slides: [refinement().slides[1]!, refinement().slides[0]!]
    });
    expect(result.ok).toBe(false);
    expect(result.issues.join(" ")).toMatch(/order|mismatch|id/iu);
  });

  it("rejects empty bullets or empty title", () => {
    const broken = refinement();
    broken.slides[0]!.bullets = [];
    broken.slides[1]!.title = "   ";
    const result = validateDeckOutlineRefinement(input, broken);
    expect(result.ok).toBe(false);
    expect(result.issues.length).toBeGreaterThanOrEqual(2);
  });

  it("rejects truncated bullets", () => {
    const broken = refinement();
    broken.slides[0]!.bullets = ["我是王小明，過去幾年的工作經驗主要在品牌MES系統開發..."];
    const result = validateDeckOutlineRefinement(input, broken);
    expect(result.ok).toBe(false);
    expect(result.issues.join(" ")).toMatch(/truncat/iu);
  });

  it("rejects fabricated numbers not present in source", () => {
    const broken = refinement();
    broken.slides[1]!.bullets = ["希望把轉換率從 18% 提升到 99%"];
    const result = validateDeckOutlineRefinement(input, broken);
    expect(result.ok).toBe(false);
    expect(result.issues.join(" ")).toMatch(/number|fabricat|99/iu);
  });

  it("rejects partial digit substrings as fabricated numbers", () => {
    const broken = refinement();
    broken.slides[1]!.bullets = ["希望把轉換率提升到 20%"];
    const result = validateDeckOutlineRefinement(input, broken);
    expect(result.ok).toBe(false);
    expect(result.issues.join(" ")).toMatch(/number|fabricat|20/iu);
  });
});
