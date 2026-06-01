export interface ChartingDecisionNote {
  chartIntentId: string;
  decision: string;
  sourceFacts: string[];
  rationale: string;
}

export interface ReviewReport {
  assumptions: string[];
  omittedOrCompressedContent: string[];
  uncertainClaims: string[];
  chartingDecisions: ChartingDecisionNote[];
  humanReviewNotes: string[];
}
