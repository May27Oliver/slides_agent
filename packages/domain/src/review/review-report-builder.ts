import type { ReviewReport } from "@/review/types";

export function buildReviewReport(input: Partial<ReviewReport>): ReviewReport {
  return {
    assumptions: input.assumptions ?? [],
    omittedOrCompressedContent: input.omittedOrCompressedContent ?? [],
    uncertainClaims: input.uncertainClaims ?? [],
    chartingDecisions: input.chartingDecisions ?? [],
    humanReviewNotes: input.humanReviewNotes ?? []
  };
}
