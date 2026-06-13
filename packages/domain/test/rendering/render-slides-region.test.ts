import { describe, expect, it } from "vitest";
import { renderSlidesRegion, renderTemplateDeck } from "@/rendering/template-html-renderer";
import { renderingDeck, renderingDesignPlanningResult } from "./rendering-fixtures";

const input = {
  deck: renderingDeck,
  designPlanningResult: renderingDesignPlanningResult,
  chartIntents: []
};

/**
 * 016 (FR-005, parity): the slides-region markup used for in-place preview updates is
 * produced by the SAME renderer as the full document — so a patched preview can never
 * drift from a full render. `renderTemplateDeck` is refactored to compose its document
 * FROM `renderSlidesRegion`, leaving its `html` output byte-identical.
 */
describe("renderSlidesRegion (016)", () => {
  it("returns slides markup that appears verbatim inside the full document", () => {
    const region = renderSlidesRegion(input);
    const full = renderTemplateDeck(input);
    expect(region.slidesHtml.length).toBeGreaterThan(0);
    expect(full.html).toContain(region.slidesHtml);
  });

  it("carries the same rendered-chart evidence as the full render", () => {
    expect(renderSlidesRegion(input).renderedCharts).toEqual(
      renderTemplateDeck(input).renderedCharts
    );
  });
});
