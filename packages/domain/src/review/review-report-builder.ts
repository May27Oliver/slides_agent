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

export function buildSegmentationReviewNotes(input: {
  repairAttempted?: boolean;
  repairSucceeded?: boolean;
  fallbackUsed?: boolean;
  issues?: string[];
}): string[] {
  const notes: string[] = [];

  if (input.repairAttempted) {
    notes.push("AI 語意切段格式未通過驗證，已嘗試自動修復。");
  }

  if (input.repairAttempted && input.repairSucceeded) {
    notes.push("AI 語意切段格式未通過驗證，已自動修復。");
  }

  if (input.fallbackUsed) {
    notes.push(
      input.repairAttempted
        ? "AI 語意切段格式修復後仍未通過驗證，已改用保守切段。"
        : "AI 語意切段未通過驗證，已改用保守切段。"
    );
  }

  return notes;
}
