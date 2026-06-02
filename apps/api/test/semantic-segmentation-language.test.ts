import { describe, expect, it } from "vitest";

interface SemanticSegmentationPromptModule {
  buildSemanticSegmentationPrompt(input: {
    sourceContent: string;
    purpose: string;
    audience: string;
    segmentationGuidance?: string;
    language?: string;
  }): {
    system: string;
    user: string;
    responseSchemaId: string;
  };
  buildSemanticSegmentationRepairPrompt(input: {
    sourceContent: string;
    invalidOutput: unknown;
    validationErrors: string[];
    language?: string;
  }): {
    system: string;
    user: string;
    responseSchemaId: string;
  };
}

async function loadSemanticSegmentationPromptModule(): Promise<SemanticSegmentationPromptModule> {
  return (await import("../src/adapters/llm/semantic-segmentation.adapter")) as SemanticSegmentationPromptModule;
}

describe("semantic segmentation language consistency", () => {
  it("keeps generated segmentation text in Traditional Chinese when language is zh-TW", async () => {
    const { buildSemanticSegmentationPrompt } = await loadSemanticSegmentationPromptModule();

    const prompt = buildSemanticSegmentationPrompt({
      sourceContent: "目標：\n- Onboarding conversion 從 18% 提升到 25%",
      purpose: "PM planning review",
      audience: "Product and engineering leads",
      language: "zh-TW"
    });

    expect(prompt.system).toContain(
      "Generated headings, summaries, rationales, and warnings MUST use OUTPUT_LANGUAGE."
    );
    expect(prompt.system).toContain(
      "sourceQuotes MUST preserve the exact original source language and text."
    );
    expect(prompt.system).toContain("Do not translate sourceQuotes.");
    expect(prompt.user).toContain("OUTPUT_LANGUAGE");
    expect(prompt.user).toContain("zh-TW");
  });

  it("keeps generated segmentation text in English when language is en", async () => {
    const { buildSemanticSegmentationPrompt } = await loadSemanticSegmentationPromptModule();

    const prompt = buildSemanticSegmentationPrompt({
      sourceContent: "Goals:\n- Improve onboarding conversion from 18% to 25%",
      purpose: "PM planning review",
      audience: "Product and engineering leads",
      language: "en"
    });

    expect(prompt.user).toContain("OUTPUT_LANGUAGE");
    expect(prompt.user).toContain("en");
  });

  it("repair prompt preserves the same language rule and never translates source quotes", async () => {
    const { buildSemanticSegmentationRepairPrompt } = await loadSemanticSegmentationPromptModule();

    const prompt = buildSemanticSegmentationRepairPrompt({
      sourceContent: "限制：\n- 不新增付費第三方 BI 工具",
      invalidOutput: { segments: [{ id: "segment_001" }] },
      validationErrors: ["segments[0].sourceQuotes is required"],
      language: "zh-TW"
    });

    expect(prompt.system).toContain(
      "Generated headings, summaries, rationales, and warnings MUST use OUTPUT_LANGUAGE."
    );
    expect(prompt.system).toContain(
      "sourceQuotes MUST preserve the exact original source language and text."
    );
    expect(prompt.system).toContain("Do not translate sourceQuotes.");
    expect(prompt.user).toContain("OUTPUT_LANGUAGE");
    expect(prompt.user).toContain("zh-TW");
  });
});
