import { describe, expect, it } from "vitest";
import { createTimeoutFailure, hasPreviewJobTimedOut, PreviewJobService } from "../../src";

describe("preview job timeout", () => {
  it("fails jobs older than 5 minutes with PREVIEW_JOB_TIMEOUT", () => {
    const service = new PreviewJobService({
      idFactory: () => "preview_job_timeout",
      now: () => new Date("2026-06-02T14:00:00.000Z")
    });
    const job = service.markRunning(
      service.createAcceptedJob({
        sourceContent: "Source",
        deckBrief: { purpose: "Review", audience: "Team" }
      }),
      "html_generation",
      new Date("2026-06-02T14:00:01.000Z")
    );

    expect(hasPreviewJobTimedOut(job, new Date("2026-06-02T14:04:59.000Z"))).toBe(false);
    expect(hasPreviewJobTimedOut(job, new Date("2026-06-02T14:05:00.000Z"))).toBe(true);

    const failed = service.markFailed(
      job,
      createTimeoutFailure("html_generation"),
      new Date("2026-06-02T14:05:00.000Z")
    );

    expect(failed.status).toBe("failed");
    expect(failed.failure?.code).toBe("PREVIEW_JOB_TIMEOUT");
    expect(failed.evidence.failureCategory).toBe("timeout");
  });
});
