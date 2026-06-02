import { describe, expect, it } from "vitest";
import { buildHtmlGenerationPrompt } from "@/rendering/html-generation-prompt";
import { validateGeneratedHtml } from "@/rendering/html-generation-validator";
import { renderingDeck, renderingDesignPlanningResult, validHtml } from "./rendering-fixtures";

describe("HTML generation design planning consumption", () => {
  it("prompts and validates from DesignPlanningResult pattern assignments and hierarchy", () => {
    const prompt = buildHtmlGenerationPrompt({
      deck: renderingDeck,
      designPlanningResult: renderingDesignPlanningResult
    });

    expect(prompt.user).toContain('"primaryPattern": "metric-comparison"');
    expect(prompt.user).toContain('"primaryMessage": "目標"');
    expect(prompt.user).not.toContain('"deckBrief"');

    const passingValidation = validateGeneratedHtml({
      html: validHtml,
      deck: renderingDeck,
      designPlanningResult: renderingDesignPlanningResult
    });
    expect(passingValidation.designCompliancePreserved).toBe(true);

    const driftingHtml = validHtml.replace('data-pattern="metric-comparison"', "");
    const failingValidation = validateGeneratedHtml({
      html: driftingHtml,
      deck: renderingDeck,
      designPlanningResult: renderingDesignPlanningResult
    });
    expect(failingValidation.designCompliancePreserved).toBe(false);
    expect(failingValidation.designIssues).toContain(
      "Missing design pattern assignment in HTML: slide_001 -> metric-comparison"
    );
  });
});
