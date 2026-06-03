import { beforeEach, describe, expect, it } from "vitest";
import RedisMock from "ioredis-mock";
import type { PreviewJob } from "@slides-agent/domain";
import { RedisPreviewJobStore } from "@/modules/slides/redis-preview-job-store";

const CREATED_AT = new Date("2026-06-03T10:00:00.000Z");

function queuedJob(id: string, overrides: Partial<PreviewJob> = {}): PreviewJob {
  return {
    id,
    status: "queued",
    stage: "request_accepted",
    createdAt: CREATED_AT,
    updatedAt: CREATED_AT,
    expiresAt: new Date("2026-06-03T10:10:00.000Z"),
    request: {
      sourceContent: "Source",
      deckBrief: { purpose: "Review", audience: "Team" }
    },
    evidence: {
      acceptedAt: CREATED_AT.toISOString(),
      stageTransitions: [{ stage: "request_accepted", at: CREATED_AT.toISOString() }],
      validationAccepted: true,
      fallbackUsed: false,
      repairAttempted: false,
      finalStatus: "queued"
    },
    ...overrides
  };
}

const SUCCESS_RESULT = {
  slideDeck: { id: "deck_1" },
  designPlanningResult: { ok: true },
  previewArtifact: { html: "<!doctype html>" }
};

describe("RedisPreviewJobStore", () => {
  let redis: RedisMock;
  let store: RedisPreviewJobStore;

  beforeEach(() => {
    redis = new RedisMock();
    store = new RedisPreviewJobStore({ redis, now: () => new Date("2026-06-03T10:00:05.000Z") });
  });

  describe("US1 create + findById", () => {
    it("persists the job and adds it to the active set", async () => {
      await store.create(queuedJob("preview_job_1"));

      expect(await redis.get("preview-job:preview_job_1")).toBeTruthy();
      expect(await redis.smembers("preview-job:active")).toContain("preview_job_1");
      expect(await redis.pttl("preview-job:preview_job_1")).toBeGreaterThan(0);
    });

    it("reads back an equivalent job via findById", async () => {
      const job = queuedJob("preview_job_2");
      await store.create(job);

      const found = await store.findById("preview_job_2");
      expect(found).toEqual(job);
    });

    it("returns undefined for an unknown job", async () => {
      expect(await store.findById("missing")).toBeUndefined();
    });

    it("fails fast with a sanitized error when Redis is unavailable", async () => {
      const brokenRedis = {
        set: async () => {
          throw new Error("connect ECONNREFUSED 10.1.2.3:6379");
        }
      } as unknown as RedisMock;
      const brokenStore = new RedisPreviewJobStore({ redis: brokenRedis });

      await expect(brokenStore.create(queuedJob("x"))).rejects.toThrow();
      await brokenStore.create(queuedJob("y")).catch((error: Error) => {
        expect(error.message).not.toContain("10.1.2.3");
        expect(error.message).not.toContain("6379");
      });
    });
  });

  describe("US2 stage transitions + cross-process read", () => {
    it("marks running and a second reader sees the update", async () => {
      await store.create(queuedJob("preview_job_run"));
      await store.markRunning("preview_job_run", "content_planning", new Date("2026-06-03T10:00:06.000Z"));

      const reader = new RedisPreviewJobStore({ redis });
      const found = await reader.findById("preview_job_run");
      expect(found?.status).toBe("running");
      expect(found?.stage).toBe("content_planning");
    });

    it("marks succeeded, stores result, and leaves the active set", async () => {
      await store.create(queuedJob("preview_job_ok"));
      await store.markRunning("preview_job_ok", "content_planning", new Date("2026-06-03T10:00:06.000Z"));
      await store.markSucceeded("preview_job_ok", SUCCESS_RESULT, new Date("2026-06-03T10:00:30.000Z"));

      const found = await store.findById("preview_job_ok");
      expect(found?.status).toBe("succeeded");
      expect(found?.result).toEqual(SUCCESS_RESULT);
      expect(await redis.smembers("preview-job:active")).not.toContain("preview_job_ok");
    });

    it("does not resurrect a terminal job", async () => {
      await store.create(queuedJob("preview_job_done"));
      await store.markSucceeded("preview_job_done", SUCCESS_RESULT, new Date("2026-06-03T10:00:30.000Z"));
      await store.markStage("preview_job_done", "html_generation", new Date("2026-06-03T10:00:31.000Z"));

      const found = await store.findById("preview_job_done");
      expect(found?.status).toBe("succeeded");
      expect(found?.stage).toBe("completed");
    });
  });

  describe("US3 active listing + expiry reconcile", () => {
    it("lists active job ids for the timeout sweeper", async () => {
      await store.create(queuedJob("preview_job_a"));
      await store.create(queuedJob("preview_job_b"));
      await store.markSucceeded("preview_job_b", SUCCESS_RESULT, new Date("2026-06-03T10:00:30.000Z"));

      const ids = await store.listActiveJobIds();
      expect(ids).toContain("preview_job_a");
      expect(ids).not.toContain("preview_job_b");
    });

    it("reconciles active ids whose job key has vanished", async () => {
      await store.create(queuedJob("preview_job_gone"));
      await redis.del("preview-job:preview_job_gone");

      await store.expireOldJobs(new Date("2026-06-03T10:00:40.000Z"));
      expect(await redis.smembers("preview-job:active")).not.toContain("preview_job_gone");
    });
  });
});
