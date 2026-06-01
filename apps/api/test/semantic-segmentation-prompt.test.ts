import { describe, expect, it } from "vitest";

interface SemanticSegmentationPromptModule {
  buildSemanticSegmentationPrompt(input: {
    sourceContent: string;
    purpose: string;
    audience: string;
    segmentationGuidance?: string;
  }): {
    system: string;
    user: string;
    responseSchemaId: string;
  };
}

async function loadSemanticSegmentationPromptModule(): Promise<SemanticSegmentationPromptModule> {
  return (await import("../src/adapters/llm/semantic-segmentation.adapter")) as SemanticSegmentationPromptModule;
}

describe("semantic segmentation prompt contract", () => {
  it("builds a prompt that asks for schema-bound JSON and exact source quotes", async () => {
    const { buildSemanticSegmentationPrompt } = await loadSemanticSegmentationPromptModule();

    const prompt = buildSemanticSegmentationPrompt({
      sourceContent: "Onboarding conversion 從 18% 提升到 25%",
      purpose: "PM planning review",
      audience: "Product and engineering leads"
    });

    expect(prompt.responseSchemaId).toBe("urn:slides-agent:contracts:semantic-segmentation");
    expect(prompt.system).toContain("Output JSON only");
    expect(prompt.system).toContain("sourceQuotes");
    expect(prompt.system).toContain("exact source quotes");
    expect(prompt.system).toContain("Do not rewrite source text");
    expect(prompt.user).toContain("SOURCE_CONTENT");
    expect(prompt.user).toContain("Onboarding conversion 從 18% 提升到 25%");
  });
});
