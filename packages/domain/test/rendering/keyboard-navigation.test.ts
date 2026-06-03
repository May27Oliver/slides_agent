import { describe, expect, it } from "vitest";
import { renderTemplateDeck } from "@/rendering/template-html-renderer";
import { renderingDeck, renderingDesignPlanningResult } from "./rendering-fixtures";

describe("fallback HTML keyboard navigation", () => {
  it("includes self-contained previous and next keyboard navigation script", () => {
    const html = renderTemplateDeck({
      deck: renderingDeck,
      designPlanningResult: renderingDesignPlanningResult
    });

    expect(html).toContain('document.addEventListener("keydown"');
    expect(html).toContain("ArrowRight");
    expect(html).toContain("ArrowLeft");
    expect(html).toContain("PageDown");
    expect(html).toContain("PageUp");
    expect(html).not.toContain("<script src=");
  });
});
