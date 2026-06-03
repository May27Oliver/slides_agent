/**
 * Backend runtime configuration for the async preview-job queue (Redis +
 * BullMQ). All values are backend-owned and must never be exposed as public
 * request/response fields. `REDIS_URL` is required: the API and the worker fail
 * fast when it is absent.
 */
export interface QueueConfig {
  redisUrl: string;
  queueName: string;
  workerConcurrency: number;
  timeoutSweepIntervalMs: number;
}

const DEFAULT_QUEUE_NAME = "preview-jobs";
const DEFAULT_WORKER_CONCURRENCY = 1;
const DEFAULT_TIMEOUT_SWEEP_INTERVAL_MS = 30 * 1000;

type EnvLike = Record<string, string | undefined>;

export function loadQueueConfig(env: EnvLike = process.env): QueueConfig {
  const redisUrl = env.REDIS_URL?.trim();
  if (!redisUrl) {
    // Safe message: names the missing knob without leaking any connection detail.
    throw new Error("REDIS_URL is required for the preview-job queue but is not configured.");
  }

  return {
    redisUrl,
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
