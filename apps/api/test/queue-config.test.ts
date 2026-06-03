import { describe, expect, it } from "vitest";
import { loadQueueConfig } from "@/modules/slides/queue.config";

describe("queue config", () => {
  it("reads Redis URL and applies defaults for the rest", () => {
    const config = loadQueueConfig({ REDIS_URL: "redis://127.0.0.1:6379" });

    expect(config).toEqual({
      redisUrl: "redis://127.0.0.1:6379",
      queueName: "preview-jobs",
      workerConcurrency: 1,
      timeoutSweepIntervalMs: 30000
    });
  });

  it("overrides defaults from environment", () => {
    const config = loadQueueConfig({
      REDIS_URL: "redis://cache:6379",
      PREVIEW_QUEUE_NAME: "preview",
      PREVIEW_WORKER_CONCURRENCY: "4",
      PREVIEW_TIMEOUT_SWEEP_INTERVAL_MS: "5000"
    });

    expect(config).toEqual({
      redisUrl: "redis://cache:6379",
      queueName: "preview",
      workerConcurrency: 4,
      timeoutSweepIntervalMs: 5000
    });
  });

  it("fails fast when REDIS_URL is missing", () => {
    expect(() => loadQueueConfig({})).toThrow(/REDIS_URL/u);
  });

  it("ignores invalid numeric overrides and falls back to defaults", () => {
    const config = loadQueueConfig({
      REDIS_URL: "redis://127.0.0.1:6379",
      PREVIEW_WORKER_CONCURRENCY: "not-a-number"
    });

    expect(config.workerConcurrency).toBe(1);
  });
});
