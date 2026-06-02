import { describe, expect, it } from "vitest";
import { loadPendingModule } from "../support/pending-module";

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
    sections: Array<{ heading: string; segmentationSource: "llm" | "deterministic_fallback" }>;
    validation: {
      repairAttempted: boolean;
      repairSucceeded: boolean;
      fallbackUsed: boolean;
      issues: string[];
    };
  }>;
}

async function loadSemanticSegmenter(): Promise<SemanticSegmenterModule> {
  return loadPendingModule<SemanticSegmenterModule>("@/content-core/semantic-segmentation-repair");
}

describe("semantic segmentation repair", () => {
  it("attempts exactly one format repair after invalid initial segmentation schema", async () => {
    const { segmentSourceContentWithRepair } = await loadSemanticSegmenter();
    let repairCalls = 0;
    const invalidOutput = { segments: [{ id: "segment_001" }], globalWarnings: [] };

    const result = await segmentSourceContentWithRepair({
      sourceContent: ["目標：", "- Onboarding conversion 從 18% 提升到 25%"].join("\n"),
      segmenter: {
        async segment() {
          return invalidOutput;
        }
      },
      repairer: {
        async repair(input) {
          repairCalls += 1;
          expect(input.invalidOutput).toBe(invalidOutput);
          expect(input.validationErrors).toEqual(
            expect.arrayContaining(["semantic segmentation output is missing or invalid"])
          );

          return {
            segments: [
              {
                id: "segment_001",
                heading: "Conversion goal",
                sourceQuotes: [
                  {
                    text: "Onboarding conversion 從 18% 提升到 25%",
                    role: "bullet"
                  }
                ],
                summary: "Conversion goal moves from 18% to 25%.",
                order: 1,
                rationale: "The source states a conversion improvement goal.",
                confidence: "high",
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
    expect(result.validation.repairSucceeded).toBe(true);
    expect(result.validation.fallbackUsed).toBe(false);
    expect(result.sections).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          heading: "Conversion goal",
          segmentationSource: "llm"
        })
      ])
    );
  });
});
