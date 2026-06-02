import { describe, expect, it } from "vitest";
import { loadPendingModule } from "../support/pending-module";

interface ReviewReportBuilderModule {
  buildSegmentationReviewNotes(input: {
    repairAttempted: boolean;
    repairSucceeded: boolean;
    fallbackUsed: boolean;
    issues: string[];
  }): string[];
}

async function loadReviewReportBuilder(): Promise<ReviewReportBuilderModule> {
  return loadPendingModule<ReviewReportBuilderModule>("@/review/review-report-builder");
}

describe("segmentation review notes", () => {
  it("explains repair and fallback in plain language without raw schema paths", async () => {
    const { buildSegmentationReviewNotes } = await loadReviewReportBuilder();

    const notes = buildSegmentationReviewNotes({
      repairAttempted: true,
      repairSucceeded: false,
      fallbackUsed: true,
      issues: ["segments[0].sourceQuotes is required", "$.segments[0].id must be string"]
    });

    expect(notes).toEqual(
      expect.arrayContaining([
        "AI 語意切段格式未通過驗證，已嘗試自動修復。",
        "AI 語意切段格式修復後仍未通過驗證，已改用保守切段。"
      ])
    );
    expect(notes.join("\n")).not.toContain("segments[0]");
    expect(notes.join("\n")).not.toContain("$.segments");
  });
});
