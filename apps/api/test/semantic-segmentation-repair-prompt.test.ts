import { describe, expect, it } from "vitest";

interface SemanticSegmentationPromptModule {
  buildSemanticSegmentationRepairPrompt(input: {
    sourceContent: string;
    invalidOutput: unknown;
    validationErrors: string[];
  }): {
    system: string;
    user: string;
    responseSchemaId: string;
  };
}

async function loadSemanticSegmentationPromptModule(): Promise<SemanticSegmentationPromptModule> {
  return (await import("../src/adapters/llm/semantic-segmentation.adapter")) as SemanticSegmentationPromptModule;
}

describe("semantic segmentation repair prompt", () => {
  it("limits repair to JSON/schema shape and forbids source reinterpretation", async () => {
    const { buildSemanticSegmentationRepairPrompt } = await loadSemanticSegmentationPromptModule();

    const prompt = buildSemanticSegmentationRepairPrompt({
      sourceContent: "本階段只做 dashboard MVP，不做 full CRM integration",
      invalidOutput: { segments: [{ id: "segment_001" }], extra: "remove me" },
      validationErrors: ["segments[0].sourceQuotes is required"]
    });

    expect(prompt.responseSchemaId).toBe("urn:slides-agent:contracts:semantic-segmentation");
    expect(prompt.system).toContain("Repair JSON/schema shape only");
    expect(prompt.system).toContain("Do not reinterpret source content");
    expect(prompt.system).toContain("Do not summarize differently");
    expect(prompt.system).toContain("Do not expand source content");
    expect(prompt.system).toContain("Do not delete source-supported content");
    expect(prompt.system).toContain("Do not rewrite sourceQuotes");
    expect(prompt.user).toContain("VALIDATION_ERRORS");
    expect(prompt.user).toContain("segments[0].sourceQuotes is required");
    expect(prompt.user).toContain("INVALID_SEGMENTATION_OUTPUT");
    expect(prompt.user).toContain("SOURCE_CONTENT");
  });
});
