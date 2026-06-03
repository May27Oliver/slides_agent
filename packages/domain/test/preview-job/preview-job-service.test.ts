import { describe, expect, it } from "vitest";
import { PreviewJobService } from "../../src";

const request = {
  sourceContent: "Onboarding conversion improved from 18% to 25%.",
  deckBrief: {
    purpose: "PM planning review",
    audience: "Product leads"
  }
};

describe("PreviewJobService", () => {
  it("creates a queued job with accepted evidence", () => {
    const service = new PreviewJobService({
      idFactory: () => "preview_job_001",
      now: () => new Date("2026-06-02T14:00:00.000Z")
    });

    const job = service.createAcceptedJob(request);

    expect(job).toMatchObject({
      id: "preview_job_001",
      status: "queued",
      stage: "request_accepted",
      request
    });
    expect(job.createdAt.toISOString()).toBe("2026-06-02T14:00:00.000Z");
    expect(job.expiresAt.toISOString()).toBe("2026-06-02T14:10:00.000Z");
    expect(job.evidence).toMatchObject({
      validationAccepted: true,
      fallbackUsed: false,
      repairAttempted: false,
      finalStatus: "queued",
      stageTransitions: [{ stage: "request_accepted", at: "2026-06-02T14:00:00.000Z" }]
    });
  });
});
