import { describe, expect, it } from "vitest";
import type { JobEvidence, JobFailure, JobStage, JobStatus, PreviewJob } from "../../src";
import { appendStageTransition, createInitialJobEvidence } from "../../src";

describe("preview job domain types", () => {
  it("exports preview job lifecycle language and records stage evidence", () => {
    const status: JobStatus = "queued";
    const stage: JobStage = "request_accepted";
    const acceptedAt = new Date("2026-06-02T14:00:00.000Z");
    const evidence: JobEvidence = createInitialJobEvidence({
      acceptedAt,
      validationAccepted: true
    });
    const failure: JobFailure = {
      code: "PREVIEW_GENERATION_FAILED",
      message: "Preview generation failed.",
      failedStage: "html_generation",
      retryable: true,
      retryGuidance: "Create a new preview job."
    };
    const job: PreviewJob = {
      id: "preview_job_test",
      status,
      stage,
      createdAt: acceptedAt,
      updatedAt: acceptedAt,
      expiresAt: new Date("2026-06-02T14:10:00.000Z"),
      request: {
        sourceContent: "Conversion improved from 18% to 25%.",
        deckBrief: {
          purpose: "Planning review",
          audience: "Product leads"
        }
      },
      evidence,
      failure
    };

    expect(job.status).toBe("queued");
    expect(job.stage).toBe("request_accepted");
    expect(job.evidence.stageTransitions).toEqual([
      { stage: "request_accepted", at: "2026-06-02T14:00:00.000Z" }
    ]);

    const runningEvidence = appendStageTransition(evidence, {
      stage: "content_planning",
      at: new Date("2026-06-02T14:00:02.000Z"),
      finalStatus: "running"
    });

    expect(runningEvidence.stageTransitions).toHaveLength(2);
    expect(runningEvidence.finalStatus).toBe("running");
    expect(failure.message).not.toContain("sk-");
  });
});
