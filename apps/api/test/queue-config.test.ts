import { describe, expect, it } from "vitest";
import { loadQueueConfig } from "@/modules/slides/queue.config";

describe("queue config", () => {
  it("applies safe defaults", () => {
    expect(loadQueueConfig({})).toEqual({
      queueName: "preview-jobs",
      workerConcurrency: 1,
      timeoutSweepIntervalMs: 30000
    });
  });

  it("overrides defaults from environment", () => {
    const config = loadQueueConfig({
      PREVIEW_QUEUE_NAME: "preview",
      PREVIEW_WORKER_CONCURRENCY: "4",
      PREVIEW_TIMEOUT_SWEEP_INTERVAL_MS: "5000"
    });

    expect(config).toEqual({
      queueName: "preview",
      workerConcurrency: 4,
      timeoutSweepIntervalMs: 5000
    });
  });

  it("ignores invalid numeric overrides and falls back to defaults", () => {
    const config = loadQueueConfig({ PREVIEW_WORKER_CONCURRENCY: "not-a-number" });

    expect(config.workerConcurrency).toBe(1);
  });
});
