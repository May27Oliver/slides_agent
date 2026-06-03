import { beforeEach, describe, expect, it } from "vitest";
import RedisMock from "ioredis-mock";
import type { PreviewJob } from "@slides-agent/domain";
import { RedisPreviewJobStore } from "@/modules/preview-jobs/redis-preview-job-store";
import { PreviewJobTimeoutSweeper } from "@/modules/preview-jobs/preview-job-timeout-sweeper";

const NOW = new Date("2026-06-03T10:06:30.000Z");
// Created > 5 minutes before NOW so it is timed out.
const STALE_CREATED_AT = new Date("2026-06-03T10:00:00.000Z");

function staleRunningJob(id: string): PreviewJob {
  return {
    id,
    status: "running",
    stage: "design_planning",
    createdAt: STALE_CREATED_AT,
    updatedAt: STALE_CREATED_AT,
    expiresAt: new Date("2026-06-03T10:10:00.000Z"),
    request: { sourceContent: "Source", deckBrief: { purpose: "P", audience: "A" } },
    evidence: {
      acceptedAt: STALE_CREATED_AT.toISOString(),
      stageTransitions: [{ stage: "request_accepted", at: STALE_CREATED_AT.toISOString() }],
      validationAccepted: true,
      fallbackUsed: false,
      repairAttempted: false,
      finalStatus: "running"
    }
  };
}

describe("PreviewJobTimeoutSweeper", () => {
  let redis: RedisMock;
  let store: RedisPreviewJobStore;

  beforeEach(() => {
    redis = new RedisMock();
    store = new RedisPreviewJobStore({ redis, now: () => STALE_CREATED_AT });
  });

  it("fails jobs that have exceeded the 5-minute timeout", async () => {
    await store.create(staleRunningJob("preview_job_stale"));
    const sweeper = new PreviewJobTimeoutSweeper({ store, redis, intervalMs: 30000, now: () => NOW });

    await sweeper.runOnce();

    const stored = await store.findById("preview_job_stale");
    expect(stored?.status).toBe("failed");
    expect(stored?.failure?.code).toBe("PREVIEW_JOB_TIMEOUT");
    expect(await redis.smembers("preview-job:active")).not.toContain("preview_job_stale");
  });

  it("leaves not-yet-timed-out jobs untouched", async () => {
    const fresh = staleRunningJob("preview_job_fresh");
    fresh.createdAt = new Date("2026-06-03T10:06:00.000Z");
    await store.create(fresh);
    const sweeper = new PreviewJobTimeoutSweeper({ store, redis, intervalMs: 30000, now: () => NOW });

    await sweeper.runOnce();

    expect((await store.findById("preview_job_fresh"))?.status).toBe("running");
  });

  it("skips the sweep when another replica holds the lease", async () => {
    await store.create(staleRunningJob("preview_job_locked"));
    // Another replica already owns the lease.
    await redis.set("preview-job:sweep:lock", "other-replica", "PX", 60000, "NX");
    const sweeper = new PreviewJobTimeoutSweeper({ store, redis, intervalMs: 30000, now: () => NOW });

    await sweeper.runOnce();

    expect((await store.findById("preview_job_locked"))?.status).toBe("running");
  });
});
