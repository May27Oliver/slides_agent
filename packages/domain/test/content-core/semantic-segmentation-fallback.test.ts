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

interface SemanticSegmenterModule {
  segmentSourceContentWithRepair(input: {
    sourceContent: string;
    segmenter: {
      segment(): Promise<unknown>;
    };
    repairer: {
      repair(input: { validationErrors: string[]; invalidOutput: unknown }): Promise<unknown>;
    };
  }): Promise<{
    sections: Array<{
      id: string;
      heading: string;
      text: string;
      segmentationSource: "llm" | "deterministic_fallback";
    }>;
    validation: {
      repairAttempted: boolean;
      repairSucceeded: boolean;
      fallbackUsed: boolean;
      issues: string[];
    };
  }>;
}

async function loadSemanticSegmentationValidator(): Promise<SemanticSegmentationValidatorModule> {
  return loadPendingModule<SemanticSegmentationValidatorModule>(
    "@/content-core/semantic-segmentation-validator"
  );
}

async function loadSemanticSegmenter(): Promise<SemanticSegmenterModule> {
  return loadPendingModule<SemanticSegmenterModule>("@/content-core/semantic-segmentation-repair");
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

  it("falls back after one failed repair attempt and records repair/fallback issues", async () => {
    const { segmentSourceContentWithRepair } = await loadSemanticSegmenter();
    let repairCalls = 0;

    const result = await segmentSourceContentWithRepair({
      sourceContent: ["風險：", "- Design resource 只有 0.5 FTE"].join("\n"),
      segmenter: {
        async segment() {
          return { segments: [{ id: "segment_001" }], globalWarnings: [] };
        }
      },
      repairer: {
        async repair() {
          repairCalls += 1;
          return {
            segments: [
              {
                id: "segment_001",
                heading: "Overstated risk",
                sourceQuotes: [
                  {
                    text: "Design resource 只有 2 FTE",
                    role: "bullet"
                  }
                ],
                summary: "Design resource risk.",
                order: 1,
                rationale: "Malformed repair fixture.",
                confidence: "low",
                warnings: []
              }
            ],
            globalWarnings: []
          };
        }
      }
    });

    expect(repairCalls).toBe(1);
    expect(result.validation.repairAttempted).toBe(true);
    expect(result.validation.repairSucceeded).toBe(false);
    expect(result.validation.fallbackUsed).toBe(true);
    expect(result.validation.issues).toEqual(
      expect.arrayContaining([
        "AI 語意切段格式修復後仍未通過驗證，已改用保守切段",
        "source quote does not exact-match source content: Design resource 只有 2 FTE"
      ])
    );
    expect(result.sections).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          heading: "風險",
          text: "Design resource 只有 0.5 FTE",
          segmentationSource: "deterministic_fallback"
        })
      ])
    );
  });
});
