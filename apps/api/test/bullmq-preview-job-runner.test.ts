import { describe, expect, it, vi } from "vitest";
import type { PreviewJob } from "@slides-agent/domain";
import { BullMqPreviewJobRunner } from "@/modules/preview-jobs/bullmq-preview-job-runner";

function job(id: string): PreviewJob {
  return {
    id,
    status: "queued",
    stage: "request_accepted",
    createdAt: new Date("2026-06-03T10:00:00.000Z"),
    updatedAt: new Date("2026-06-03T10:00:00.000Z"),
    expiresAt: new Date("2026-06-03T10:10:00.000Z"),
    request: { sourceContent: "Source", deckBrief: { purpose: "P", audience: "A" } },
    evidence: {
      acceptedAt: "2026-06-03T10:00:00.000Z",
      stageTransitions: [{ stage: "request_accepted", at: "2026-06-03T10:00:00.000Z" }],
      validationAccepted: true,
      fallbackUsed: false,
      repairAttempted: false,
      finalStatus: "queued"
    }
  };
}

describe("BullMqPreviewJobRunner", () => {
  it("enqueues only the job id with no retries", async () => {
    const add = vi.fn().mockResolvedValue(undefined);
    const runner = new BullMqPreviewJobRunner({ queue: { add }, jobName: "generate" });

    await runner.start(job("preview_job_1"));

    expect(add).toHaveBeenCalledTimes(1);
    expect(add).toHaveBeenCalledWith(
      "generate",
      { jobId: "preview_job_1" },
      expect.objectContaining({
        attempts: 1,
        removeOnComplete: true,
        removeOnFail: expect.objectContaining({ count: 100 })
      })
    );
  });

  it("does not embed the full request in the payload", async () => {
    const add = vi.fn().mockResolvedValue(undefined);
    const runner = new BullMqPreviewJobRunner({ queue: { add } });

    await runner.start(job("preview_job_2"));

    const [, payload] = add.mock.calls[0]!;
    expect(payload).toEqual({ jobId: "preview_job_2" });
    expect(JSON.stringify(payload)).not.toContain("Source");
  });
});
