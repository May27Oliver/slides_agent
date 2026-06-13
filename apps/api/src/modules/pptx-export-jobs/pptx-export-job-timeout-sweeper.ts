import { createPptxTimeoutFailure, hasPptxExportJobTimedOut } from "@slides-agent/domain";
import {
  pptxArtifactRef,
  type PptxArtifactStore
} from "@/modules/pptx-export-jobs/fs-pptx-artifact-store";
import type { RedisPptxExportJobStore } from "@/modules/pptx-export-jobs/redis-pptx-export-job-store";
import type { SweeperRedis } from "@/modules/preview-jobs/preview-job-timeout-sweeper";

interface SweeperLogger {
  log(message: string): void;
  error(message: string): void;
}

export interface PptxExportJobTimeoutSweeperOptions {
  store: Pick<
    RedisPptxExportJobStore,
    "listActiveJobIds" | "findById" | "markFailed" | "expireOldJobs"
  >;
  artifacts: PptxArtifactStore;
  redis: SweeperRedis;
  intervalMs: number;
  /** Artifacts older than this are purged regardless of job state (FR-018). */
  artifactMaxAgeMs: number;
  now?: () => Date;
  logger?: SweeperLogger;
  leaseKey?: string;
  leaseToken?: () => string;
}

const DEFAULT_LEASE_KEY = "pptx-export-job:sweep:lock";

/**
 * 015 US2: out-of-worker timeout enforcement + artifact retention, mirroring the
 * preview sweeper. A crashed chromium cannot fail its own job; this sweep marks
 * stalled exports failed and purges artifacts past their retention window.
 */
export class PptxExportJobTimeoutSweeper {
  private readonly store: PptxExportJobTimeoutSweeperOptions["store"];
  private readonly artifacts: PptxArtifactStore;
  private readonly redis: SweeperRedis;
  private readonly intervalMs: number;
  private readonly artifactMaxAgeMs: number;
  private readonly now: () => Date;
  private readonly logger: SweeperLogger;
  private readonly leaseKey: string;
  private readonly leaseToken: () => string;
  private timer: ReturnType<typeof setInterval> | undefined;

  constructor(options: PptxExportJobTimeoutSweeperOptions) {
    this.store = options.store;
    this.artifacts = options.artifacts;
    this.redis = options.redis;
    this.intervalMs = options.intervalMs;
    this.artifactMaxAgeMs = options.artifactMaxAgeMs;
    this.now = options.now ?? (() => new Date());
    this.logger = options.logger ?? console;
    this.leaseKey = options.leaseKey ?? DEFAULT_LEASE_KEY;
    this.leaseToken = options.leaseToken ?? defaultLeaseToken;
  }

  start(): void {
    if (this.timer) {
      return;
    }
    this.timer = setInterval(() => {
      void this.runOnce().catch((error: unknown) => {
        this.logger.error(`pptx timeout sweep error: ${asName(error)}`);
      });
    }, this.intervalMs);
    this.timer.unref?.();
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = undefined;
    }
  }

  async runOnce(): Promise<void> {
    if (!(await this.acquireLease())) {
      return;
    }

    const at = this.now();
    for (const id of await this.store.listActiveJobIds()) {
      const job = await this.store.findById(id);
      if (!job) {
        continue;
      }
      if (hasPptxExportJobTimedOut(job, at)) {
        await this.store.markFailed(job.id, createPptxTimeoutFailure(), at);
        // FR-018: a stalled/crashed worker may have left a partial artifact it never
        // registered. Remove it so a half-finished .pptx can never be downloaded
        // (delete is idempotent — a no-op when nothing was written).
        await this.artifacts.delete(pptxArtifactRef(job.id)).catch(() => undefined);
        this.logger.error(`${job.id} failed code=PPTX_EXPORT_TIMEOUT`);
      }
    }
    await this.store.expireOldJobs(at);
    const purged = await this.artifacts.purgeOlderThan(this.artifactMaxAgeMs, at);
    if (purged > 0) {
      this.logger.log(`pptx artifact purge removed=${purged}`);
    }
  }

  private async acquireLease(): Promise<boolean> {
    const ttlMs = Math.max(Math.floor(this.intervalMs * 0.8), 1000);
    const result = await this.redis.set(this.leaseKey, this.leaseToken(), "PX", ttlMs, "NX");
    return result === "OK";
  }
}

function defaultLeaseToken(): string {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${process.pid}`;
}

function asName(error: unknown): string {
  return error instanceof Error ? error.name : "UnknownError";
}
