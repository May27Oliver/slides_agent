import { describe, expect, it } from "vitest";
import type { ReviewReport } from "@/review/types";
import { loadPendingModule } from "../support/pending-module";

interface ReviewReportBuilderModule {
  buildReviewReport(input: ReviewReport): ReviewReport;
}

describe("review report", () => {
  it("always includes required reviewability fields", async () => {
    const { buildReviewReport } = await loadPendingModule<ReviewReportBuilderModule>(
      "@/review/review-report-builder"
    );

    const report = buildReviewReport({
      assumptions: ["Deck purpose interpreted as PM planning review."],
      omittedOrCompressedContent: [
        "Historical import limitation compressed into constraints slide."
      ],
      uncertainClaims: [],
      chartingDecisions: [
        {
          chartIntentId: "conversion-before-after",
          decision: "Use metric comparison for 18% to 25%.",
          sourceFacts: ["18%", "25%"],
          rationale: "Source contains before/after values."
        }
      ],
      humanReviewNotes: ["Review whether 0.5 FTE design resource is a launch blocker."]
    });

    expect(report).toEqual({
      assumptions: expect.arrayContaining(["Deck purpose interpreted as PM planning review."]),
      omittedOrCompressedContent: expect.arrayContaining([
        "Historical import limitation compressed into constraints slide."
      ]),
      uncertainClaims: [],
      chartingDecisions: expect.arrayContaining([
        expect.objectContaining({
          chartIntentId: "conversion-before-after",
          sourceFacts: ["18%", "25%"]
        })
      ]),
      humanReviewNotes: expect.arrayContaining([
        "Review whether 0.5 FTE design resource is a launch blocker."
      ])
    });
  });
});
