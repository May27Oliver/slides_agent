import { beforeEach, describe, expect, it } from "vitest";
import RedisMock from "ioredis-mock";
import type { PptxExportJob } from "@slides-agent/domain";
import { RedisPptxExportJobStore } from "@/modules/pptx-export-jobs/redis-pptx-export-job-store";

const NOW = new Date("2026-06-13T10:00:00.000Z");

function queuedJob(id: string, overrides: Partial<PptxExportJob> = {}): PptxExportJob {
  return {
    id,
    accountId: "acc-1",
    deckId: "11111111-1111-1111-1111-111111111111",
    revision: 3,
    pageCount: 5,
    status: "queued",
    createdAt: NOW,
    updatedAt: NOW,
    expiresAt: new Date("2026-06-13T10:03:00.000Z"),
    ...overrides
  };
}

describe("RedisPptxExportJobStore single-flight (FR-006)", () => {
  let redis: RedisMock;
  let store: RedisPptxExportJobStore;

  beforeEach(async () => {
    redis = new RedisMock();
    // ioredis-mock shares its keyspace across instances; flush so each test is isolated.
    await redis.flushall();
    store = new RedisPptxExportJobStore({ redis, now: () => NOW });
  });

  it("createIfNoActive persists the job, indexes it, and takes the account lock", async () => {
    const result = await store.createIfNoActive(queuedJob("pptx_job_1"));

    expect(result.ok).toBe(true);
    expect(await redis.get("pptx-export-job:pptx_job_1")).toBeTruthy();
    expect(await redis.smembers("pptx-export-job:active")).toContain("pptx_job_1");
    expect(await redis.get("pptx-export-job:account-lock:acc-1")).toBe("pptx_job_1");
  });

  it("rejects a second create for the same account, returning the in-flight job", async () => {
    await store.createIfNoActive(queuedJob("pptx_job_1"));
    const second = await store.createIfNoActive(queuedJob("pptx_job_2"));

    expect(second.ok).toBe(false);
    if (!second.ok) {
      expect(second.active.id).toBe("pptx_job_1");
    }
    // The loser must not have been written or indexed.
    expect(await redis.get("pptx-export-job:pptx_job_2")).toBeNull();
    expect(await redis.smembers("pptx-export-job:active")).not.toContain("pptx_job_2");
  });

  it("allows a different account to create concurrently (lock is per-account)", async () => {
    await store.createIfNoActive(queuedJob("pptx_job_1", { accountId: "acc-1" }));
    const other = await store.createIfNoActive(queuedJob("pptx_job_2", { accountId: "acc-2" }));

    expect(other.ok).toBe(true);
  });

  it("releases the lock when the job reaches a terminal state (markDone)", async () => {
    await store.createIfNoActive(queuedJob("pptx_job_1"));
    await store.markDone("pptx_job_1", { artifactRef: "a.pptx", byteSize: 9, pageCount: 5 }, NOW);

    expect(await redis.get("pptx-export-job:account-lock:acc-1")).toBeNull();
    const next = await store.createIfNoActive(queuedJob("pptx_job_2"));
    expect(next.ok).toBe(true);
  });

  it("releases the lock on failure (markFailed) so the account is not stuck", async () => {
    await store.createIfNoActive(queuedJob("pptx_job_1"));
    await store.markFailed("pptx_job_1", { reason: "export", message: "boom" }, NOW);

    expect(await redis.get("pptx-export-job:account-lock:acc-1")).toBeNull();
    const next = await store.createIfNoActive(queuedJob("pptx_job_2"));
    expect(next.ok).toBe(true);
  });

  it("rolls back the lock and job key if indexing fails after the lock is taken", async () => {
    // A real partial failure: lock + writeJob succeed, then sadd(active) throws.
    let failNextSadd = true;
    const flaky = new Proxy(redis, {
      get(target, prop, receiver) {
        if (prop === "sadd") {
          return async (...args: unknown[]) => {
            if (failNextSadd) {
              failNextSadd = false;
              throw new Error("redis sadd failed");
            }
            return (target as unknown as { sadd: (...a: unknown[]) => Promise<number> }).sadd(
              ...args
            );
          };
        }
        return Reflect.get(target, prop, receiver);
      }
    });
    const flakyStore = new RedisPptxExportJobStore({ redis: flaky as never, now: () => NOW });

    await expect(flakyStore.createIfNoActive(queuedJob("pptx_job_1"))).rejects.toThrow();

    // No leaked lock, no orphaned job key — the account must be free to retry.
    expect(await redis.get("pptx-export-job:account-lock:acc-1")).toBeNull();
    expect(await redis.get("pptx-export-job:pptx_job_1")).toBeNull();
    const retry = await store.createIfNoActive(queuedJob("pptx_job_2"));
    expect(retry.ok).toBe(true);
  });

  // NOTE: true two-callers-at-once atomicity rests on Redis SET NX being evaluated
  // single-threaded server-side; ioredis-mock does not faithfully serialize concurrent
  // commands, so a Promise.all race here would test the mock, not the gate. The
  // sequential tests above prove the lock blocks a second create and is released on
  // every terminal transition — which is the behaviour SET NX guarantees in production.
});
