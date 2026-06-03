import type { DeckOutlineRefinementInput } from "@slides-agent/domain";
import { describe, expect, it, vi } from "vitest";
import {
  buildDeckOutlinePlanningPrompt,
  DeckOutlinePlanningAdapter
} from "@/adapters/llm/deck-outline-planning.adapter";
import type { LlmCompletionClient } from "@/adapters/llm/openai-responses.client";

const input: DeckOutlineRefinementInput = {
  deck: {
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
      }
    ],
    reviewReport: {
      assumptions: [],
      omittedOrCompressedContent: [],
      uncertainClaims: [],
      chartingDecisions: [],
      humanReviewNotes: []
    }
  },
  sourceSections: [
    {
      id: "section_intro",
      heading: "自我介紹",
      text: "我是王小明，有 6 年全端工程經驗。",
      segmentationSource: "llm"
    }
  ],
  deckBrief: { purpose: "面試", audience: "長官", language: "zh-TW" }
};

describe("DeckOutlinePlanningAdapter", () => {
  it("builds a grounded prompt carrying slide ids, source sections, and output language", () => {
    const prompt = buildDeckOutlinePlanningPrompt(input);
    expect(prompt.system).toMatch(/grounded/iu);
    expect(prompt.user).toContain("slide_001");
    expect(prompt.user).toContain("section_intro");
    expect(prompt.user).toContain("zh-TW");
  });

  it("parses a fenced JSON refinement from the LLM", async () => {
    const client: LlmCompletionClient = {
      complete: vi.fn().mockResolvedValue(
        "```json\n" +
        JSON.stringify({
          slides: [
            { id: "slide_001", title: "自我介紹", message: "面試", bullets: ["我是王小明"] }
          ]
        }) +
        "\n```"
      )
    };
    const adapter = new DeckOutlinePlanningAdapter({ client });
    const result = await adapter.refineDeckOutline(input);
    expect(result.slides[0]?.id).toBe("slide_001");
    expect(result.slides[0]?.bullets).toEqual(["我是王小明"]);
    expect(client.complete).toHaveBeenCalledWith(
      expect.objectContaining({ operation: "deck_outline_planning" })
    );
  });

  it("throws on malformed JSON output", async () => {
    const client: LlmCompletionClient = {
      complete: vi.fn().mockResolvedValue("not json at all")
    };
    const adapter = new DeckOutlinePlanningAdapter({ client });
    await expect(adapter.refineDeckOutline(input)).rejects.toThrow(/invalid JSON/iu);
  });
});
