import { describe, expect, it } from "vitest";
import { LlmAssistedHtmlDeckGenerator } from "@/rendering/html-deck-renderer";
import { renderingDeck, renderingDesignPlanningResult, validHtml } from "./rendering-fixtures";

describe("HTML generation repair and fallback", () => {
  it("attempts one HTML repair before using conservative fallback renderer", async () => {
    const invalidHtml = validHtml
      .replace('data-slide-id="slide_001"', 'data-slide-id="slide_wrong"')
      .replace('data-pattern="metric-comparison"', "");
    const calls = {
      generate: 0,
      repair: 0
    };

    const generator = new LlmAssistedHtmlDeckGenerator({
      htmlGenerationPort: {
        async generateHtml() {
          calls.generate += 1;
          return invalidHtml;
        },
        async repairHtml() {
          calls.repair += 1;
          return invalidHtml;
        }
      }
    });

    const artifact = await generator.generate({
      deck: renderingDeck,
      designPlanningResult: renderingDesignPlanningResult
    });

    expect(calls).toEqual({ generate: 1, repair: 1 });
    expect(artifact.html).toContain('data-slide-id="slide_001"');
    expect(artifact.html).toContain('data-pattern="metric-comparison"');
    expect(artifact.htmlGenerationValidation).toMatchObject({
      status: "fallback_used",
      repairAttempted: true,
      fallbackUsed: true,
      slideCountAndOrderPreserved: true,
      designCompliancePreserved: true,
      speakerNotesHidden: true
    });
  });
});
