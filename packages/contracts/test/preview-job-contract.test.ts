import { describe, expect, it } from "vitest";
import { validateCreatePreviewJobResponse, validatePreviewJobStatusResponse } from "../src";
import type { CreatePreviewJobResponseContract, PreviewJobStatusResponseContract } from "../src";

describe("preview job contracts", () => {
  it("accepts a create-job response with tracking details", () => {
    const response: CreatePreviewJobResponseContract = {
      jobId: "preview_job_123",
      status: "queued",
      stage: "request_accepted",
      createdAt: "2026-06-02T14:00:00.000Z",
      updatedAt: "2026-06-02T14:00:00.000Z",
      statusUrl: "/api/slides/preview-jobs/preview_job_123"
    };

    expect(validateCreatePreviewJobResponse(response)).toEqual({
      ok: true,
      value: response
    });
  });

  it("accepts running, succeeded, failed, and unavailable status response shapes", () => {
    const running: PreviewJobStatusResponseContract = {
      jobId: "preview_job_123",
      status: "running",
      stage: "design_planning",
      createdAt: "2026-06-02T14:00:00.000Z",
      updatedAt: "2026-06-02T14:00:08.000Z",
      evidence: {
        stageTransitions: [
          { stage: "request_accepted", at: "2026-06-02T14:00:00.000Z" },
          { stage: "design_planning", at: "2026-06-02T14:00:08.000Z" }
        ],
        validationAccepted: true,
        fallbackUsed: false,
        repairAttempted: false,
        finalStatus: "running"
      }
    };
    const succeeded: PreviewJobStatusResponseContract = {
      ...running,
      status: "succeeded",
      stage: "completed",
      result: {
        slideDeck: {},
        designPlanningResult: {},
        previewArtifact: {
          html: "<!doctype html><html><body></body></html>",
          htmlGenerationValidation: {
            status: "pass",
            selfContained: true,
            slideCountAndOrderPreserved: true,
            contentFidelityPreserved: true,
            designCompliancePreserved: true,
            speakerNotesHidden: true,
            keyboardNavigationPresent: true,
            externalResourceIssues: [],
            contentIssues: [],
            designIssues: [],
            repairAttempted: false,
            fallbackUsed: false
          },
          generationSummary: {
            slideCount: 1,
            sourceFactCount: 1,
            chartIntentCount: 0,
            uncertainClaimCount: 0
          }
        }
      },
      evidence: {
        ...running.evidence,
        finalStatus: "succeeded"
      }
    };
    const failed: PreviewJobStatusResponseContract = {
      ...running,
      status: "failed",
      stage: "failed",
      failure: {
        code: "PREVIEW_JOB_TIMEOUT",
        message: "Preview generation did not complete in time.",
        failedStage: "html_generation",
        retryable: true,
        retryGuidance: "Create a new preview job."
      },
      evidence: {
        ...running.evidence,
        finalStatus: "failed",
        failureCategory: "timeout"
      }
    };
    const unavailable = {
      code: "PREVIEW_JOB_UNAVAILABLE",
      message: "Preview job is unavailable."
    };

    expect(validatePreviewJobStatusResponse(running).ok).toBe(true);
    expect(validatePreviewJobStatusResponse(succeeded).ok).toBe(true);
    expect(validatePreviewJobStatusResponse(failed).ok).toBe(true);
    expect(validatePreviewJobStatusResponse(unavailable).ok).toBe(true);
  });
});
