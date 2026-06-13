import { beforeEach, describe, expect, it } from "vitest";
import RedisMock from "ioredis-mock";
import type { PptxExportJob } from "@slides-agent/domain";
import type { PptxArtifactStore } from "@/modules/pptx-export-jobs/fs-pptx-artifact-store";
import { RedisPptxExportJobStore } from "@/modules/pptx-export-jobs/redis-pptx-export-job-store";
import { PptxExportJobTimeoutSweeper } from "@/modules/pptx-export-jobs/pptx-export-job-timeout-sweeper";

const CREATED_AT = new Date("2026-06-13T10:00:00.000Z");
// 4 minutes after creation — past the 3-minute hard timeout.
const NOW = new Date("2026-06-13T10:04:00.000Z");

function processingJob(id: string, overrides: Partial<PptxExportJob> = {}): PptxExportJob {
  return {
    id,
    accountId: "acc-1",
    deckId: "11111111-1111-1111-1111-111111111111",
    revision: 3,
    pageCount: 5,
    status: "queued",
    createdAt: CREATED_AT,
    updatedAt: CREATED_AT,
    expiresAt: new Date("2026-06-13T10:03:00.000Z"),
    ...overrides
  };
}

function makeArtifacts(overrides: Partial<PptxArtifactStore> = {}): PptxArtifactStore {
  return {
    write: async () => ({ artifactRef: "x.pptx", byteSize: 1 }),
    read: async () => undefined,
    delete: async () => undefined,
    purgeOlderThan: async () => 0,
    ...overrides
  };
}

describe("PptxExportJobTimeoutSweeper", () => {
  let redis: RedisMock;
  let store: RedisPptxExportJobStore;

  beforeEach(async () => {
    redis = new RedisMock();
    await redis.flushall(); // ioredis-mock shares its keyspace across instances
    store = new RedisPptxExportJobStore({ redis, now: () => CREATED_AT });
  });

  it("fails a timed-out job AND removes its partial artifact (FR-018)", async () => {
    await store.createIfNoActive(processingJob("pptx_job_stale"));
    await store.markProcessing("pptx_job_stale", CREATED_AT);

    const deleted: string[] = [];
    const sweeper = new PptxExportJobTimeoutSweeper({
      store,
      artifacts: makeArtifacts({
        delete: async (ref) => void deleted.push(ref)
      }),
      redis,
      intervalMs: 30000,
      artifactMaxAgeMs: 60 * 60 * 1000,
      now: () => NOW
    });

    await sweeper.runOnce();

    const stored = await store.findById("pptx_job_stale");
    expect(stored?.status).toBe("failed");
    expect(stored?.failure?.reason).toBe("timeout");
    // The half-finished artifact must be purged so it can never be downloaded.
    expect(deleted).toContain("pptx_job_stale.pptx");
    // The single-flight lock must be released too (account not stuck).
    expect(await redis.get("pptx-export-job:account-lock:acc-1")).toBeNull();
  });

  it("leaves a not-yet-timed-out job and its artifact untouched", async () => {
    await store.createIfNoActive(
      processingJob("pptx_job_fresh", { createdAt: new Date("2026-06-13T10:03:30.000Z") })
    );
    await store.markProcessing("pptx_job_fresh", new Date("2026-06-13T10:03:30.000Z"));

    const deleted: string[] = [];
    const sweeper = new PptxExportJobTimeoutSweeper({
      store,
      artifacts: makeArtifacts({ delete: async (ref) => void deleted.push(ref) }),
      redis,
      intervalMs: 30000,
      artifactMaxAgeMs: 60 * 60 * 1000,
      now: () => NOW
    });

    await sweeper.runOnce();

    expect((await store.findById("pptx_job_fresh"))?.status).toBe("processing");
    expect(deleted).not.toContain("pptx_job_fresh.pptx");
  });
});
