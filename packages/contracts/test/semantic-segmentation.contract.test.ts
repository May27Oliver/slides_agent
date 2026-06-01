import { describe, expect, it } from "vitest";
import { loadPendingModule } from "./support/pending-module";

interface SemanticSegmentationModule {
  SEMANTIC_SEGMENTATION_SCHEMA_ID: string;
  validateSemanticSegmentationOutput(input: unknown): {
    ok: boolean;
    errors: Array<{ path: string; message: string }>;
  };
}

async function loadSemanticSegmentationModule(): Promise<SemanticSegmentationModule> {
  return loadPendingModule<SemanticSegmentationModule>("@/semantic-segmentation");
}

describe("semantic segmentation output contract", () => {
  it("accepts schema-bound LLM segmentation output with exact source quote fields", async () => {
    const { SEMANTIC_SEGMENTATION_SCHEMA_ID, validateSemanticSegmentationOutput } =
      await loadSemanticSegmentationModule();

    const result = validateSemanticSegmentationOutput({
      segments: [
        {
          id: "segment_001",
          heading: "Q3 goals focus on conversion, response time, and MVP delivery",
          sourceQuotes: [
            {
              text: "Onboarding conversion 從 18% 提升到 25%",
              role: "bullet"
            }
          ],
          summary: "This section defines measurable Q3 goals.",
          order: 1,
          rationale: "The quoted source text describes a measurable goal.",
          confidence: "high",
          warnings: []
        }
      ],
      globalWarnings: []
    });

    expect(SEMANTIC_SEGMENTATION_SCHEMA_ID).toBe(
      "urn:slides-agent:contracts:semantic-segmentation"
    );
    expect(result).toEqual({
      ok: true,
      errors: []
    });
  });

  it("rejects non-schema fields so LLM output cannot smuggle extra instructions", async () => {
    const { validateSemanticSegmentationOutput } = await loadSemanticSegmentationModule();

    const result = validateSemanticSegmentationOutput({
      segments: [
        {
          id: "segment_001",
          heading: "Q3 goals",
          sourceQuotes: [{ text: "Onboarding conversion 從 18% 提升到 25%", role: "bullet" }],
          summary: "This section defines Q3 goals.",
          order: 1,
          rationale: "The source text describes a measurable goal.",
          confidence: "high",
          warnings: [],
          rewrittenBody: "Conversion is already achieved."
        }
      ],
      globalWarnings: []
    });

    expect(result.ok).toBe(false);
    expect(result.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: "/segments/0/rewrittenBody"
        })
      ])
    );
  });
});
