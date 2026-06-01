import { describe, expect, it } from "vitest";
import { loadPendingModule } from "../support/pending-module";

interface SemanticSegmentationValidatorModule {
  validateSemanticSegments(input: {
    sourceContent: string;
    segments: Array<{
      id: string;
      heading: string;
      sourceQuotes: Array<{ text: string; role: string }>;
      order: number;
    }>;
  }): {
    schemaValid: boolean;
    quoteGroundingValid: boolean;
    sourceOrderValid: boolean;
    importantContentCoverageValid: boolean;
    fallbackUsed: boolean;
    issues: string[];
  };
}

async function loadSemanticSegmentationValidator(): Promise<SemanticSegmentationValidatorModule> {
  return loadPendingModule<SemanticSegmentationValidatorModule>(
    "@/content-core/semantic-segmentation-validator"
  );
}

describe("semantic segmentation validation", () => {
  it("validates exact source quote grounding and source order before downstream planning", async () => {
    const { validateSemanticSegments } = await loadSemanticSegmentationValidator();

    const result = validateSemanticSegments({
      sourceContent: [
        "目標：",
        "- Onboarding conversion 從 18% 提升到 25%",
        "風險：",
        "- Design resource 只有 0.5 FTE"
      ].join("\n"),
      segments: [
        {
          id: "segment_001",
          heading: "Goals",
          sourceQuotes: [
            {
              text: "Onboarding conversion 從 18% 提升到 25%",
              role: "bullet"
            }
          ],
          order: 1
        },
        {
          id: "segment_002",
          heading: "Risks",
          sourceQuotes: [
            {
              text: "Design resource 只有 0.5 FTE",
              role: "bullet"
            }
          ],
          order: 2
        }
      ]
    });

    expect(result).toEqual({
      schemaValid: true,
      quoteGroundingValid: true,
      sourceOrderValid: true,
      importantContentCoverageValid: true,
      fallbackUsed: false,
      issues: []
    });
  });

  it("marks quote grounding invalid when an LLM rewrites source text", async () => {
    const { validateSemanticSegments } = await loadSemanticSegmentationValidator();

    const result = validateSemanticSegments({
      sourceContent: "Onboarding conversion 從 18% 提升到 25%",
      segments: [
        {
          id: "segment_001",
          heading: "Conversion achieved",
          sourceQuotes: [
            {
              text: "Onboarding conversion 已經達到 25%",
              role: "bullet"
            }
          ],
          order: 1
        }
      ]
    });

    expect(result.quoteGroundingValid).toBe(false);
    expect(result.issues).toEqual(
      expect.arrayContaining([
        "source quote does not exact-match source content: Onboarding conversion 已經達到 25%"
      ])
    );
  });
});
