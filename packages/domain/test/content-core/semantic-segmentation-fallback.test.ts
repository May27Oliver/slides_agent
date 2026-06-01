import { describe, expect, it } from "vitest";
import { loadPendingModule } from "../support/pending-module";

interface SemanticSegmentationValidatorModule {
  segmentSourceContent(input: { sourceContent: string; llmOutput: unknown }): {
    sections: Array<{
      id: string;
      heading: string;
      text: string;
      segmentationSource: "llm" | "deterministic_fallback";
    }>;
    validation: {
      fallbackUsed: boolean;
      issues: string[];
    };
  };
}

async function loadSemanticSegmentationValidator(): Promise<SemanticSegmentationValidatorModule> {
  return loadPendingModule<SemanticSegmentationValidatorModule>(
    "@/content-core/semantic-segmentation-validator"
  );
}

describe("semantic segmentation fallback", () => {
  it("uses deterministic fallback when LLM segmentation output fails validation", async () => {
    const { segmentSourceContent } = await loadSemanticSegmentationValidator();

    const result = segmentSourceContent({
      sourceContent: ["目標：", "- Onboarding conversion 從 18% 提升到 25%"].join("\n"),
      llmOutput: {
        segments: [
          {
            id: "segment_001",
            heading: "Unsupported claim",
            sourceQuotes: [
              {
                text: "Onboarding conversion 已經達標",
                role: "bullet"
              }
            ],
            summary: "Conversion already reached the target.",
            order: 1,
            rationale: "The guidance asked for a stronger result.",
            confidence: "low",
            warnings: []
          }
        ],
        globalWarnings: []
      }
    });

    expect(result.validation.fallbackUsed).toBe(true);
    expect(result.validation.issues).toEqual(
      expect.arrayContaining([
        "source quote does not exact-match source content: Onboarding conversion 已經達標"
      ])
    );
    expect(result.sections).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          heading: "目標",
          text: "Onboarding conversion 從 18% 提升到 25%",
          segmentationSource: "deterministic_fallback"
        })
      ])
    );
  });
});
