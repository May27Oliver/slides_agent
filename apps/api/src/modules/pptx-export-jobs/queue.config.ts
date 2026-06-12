import { tmpdir } from "node:os";
import { join } from "node:path";

/**
 * 015 US2: PPTX export queue tuning. Backend-owned; never exposed as public
 * request/response fields. Mirrors the preview queue's knobs plus the artifact
 * directory the worker writes .pptx files into (FR-018: TTL-purged).
 */
export interface PptxQueueConfig {
  queueName: string;
  workerConcurrency: number;
  timeoutSweepIntervalMs: number;
  artifactDir: string;
}

const DEFAULT_QUEUE_NAME = "pptx-exports";
const DEFAULT_WORKER_CONCURRENCY = 1;
const DEFAULT_TIMEOUT_SWEEP_INTERVAL_MS = 30 * 1000;

type EnvLike = Record<string, string | undefined>;

export function loadPptxQueueConfig(env: EnvLike = process.env): PptxQueueConfig {
  return {
    queueName: env.PPTX_QUEUE_NAME?.trim() || DEFAULT_QUEUE_NAME,
    workerConcurrency: positiveIntOr(env.PPTX_WORKER_CONCURRENCY, DEFAULT_WORKER_CONCURRENCY),
    timeoutSweepIntervalMs: positiveIntOr(
      env.PPTX_TIMEOUT_SWEEP_INTERVAL_MS,
      DEFAULT_TIMEOUT_SWEEP_INTERVAL_MS
    ),
    artifactDir: env.PPTX_ARTIFACT_DIR?.trim() || join(tmpdir(), "slides-agent-pptx")
  };
}

function positiveIntOr(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}
