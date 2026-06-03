/**
 * Preview-job queue tuning. Backend-owned; never exposed as public
 * request/response fields. The Redis connection itself lives in RedisModule
 * (`REDIS_URL`); this config only covers the preview queue's own knobs, all of
 * which have safe defaults.
 */
export interface QueueConfig {
  queueName: string;
  workerConcurrency: number;
  timeoutSweepIntervalMs: number;
}

const DEFAULT_QUEUE_NAME = "preview-jobs";
const DEFAULT_WORKER_CONCURRENCY = 1;
const DEFAULT_TIMEOUT_SWEEP_INTERVAL_MS = 30 * 1000;

type EnvLike = Record<string, string | undefined>;

export function loadQueueConfig(env: EnvLike = process.env): QueueConfig {
  return {
    queueName: env.PREVIEW_QUEUE_NAME?.trim() || DEFAULT_QUEUE_NAME,
    workerConcurrency: positiveIntOr(env.PREVIEW_WORKER_CONCURRENCY, DEFAULT_WORKER_CONCURRENCY),
    timeoutSweepIntervalMs: positiveIntOr(
      env.PREVIEW_TIMEOUT_SWEEP_INTERVAL_MS,
      DEFAULT_TIMEOUT_SWEEP_INTERVAL_MS
    )
  };
}

function positiveIntOr(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}
