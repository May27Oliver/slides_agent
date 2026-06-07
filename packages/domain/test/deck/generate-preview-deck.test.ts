import { describe, expect, it } from "vitest";
import { generatePreviewDeck } from "@/deck/generate-preview-deck";
import { readRootFixture } from "../support/fixtures";

describe("generate preview deck", () => {
  it("produces a reviewable slide deck and generation summary from the planning fixture", () => {
    const result = generatePreviewDeck({
      sourceContent: readRootFixture("planning-brief.md"),
      deckBrief: {
        purpose: "PM planning review",
        audience: "Product and engineering leads",
        styleDirection: "高密度 PM planning deck，強調風險、里程碑與 KPI",
        chartEmphasis: "把 conversion、回覆時間、deadline 和 resource risk 做成容易比較的視覺重點"
      }
    });

    expect(result.slideDeck).toEqual(
      expect.objectContaining({
        title: "Q3 Product Planning",
        purpose: "PM planning review",
        audience: "Product and engineering leads",
        reviewReport: expect.objectContaining({
          assumptions: expect.any(Array),
          omittedOrCompressedContent: expect.any(Array),
          uncertainClaims: expect.any(Array),
          chartingDecisions: expect.any(Array),
          humanReviewNotes: expect.any(Array)
        })
      })
    );
    expect(result.slideDeck.slides.length).toBeGreaterThan(0);
    expect(result.generationSummary).toEqual(
      expect.objectContaining({
        sourceFactCount: 8,
        chartIntentCount: 2
      })
    );
  });
});
