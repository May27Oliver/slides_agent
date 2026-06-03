import type { PreviewJob } from "@slides-agent/domain";
import { hasPreviewJobTimedOut, timeoutFailureForJob } from "@slides-agent/domain";
import type { RedisPreviewJobStore } from "@/modules/preview-jobs/redis-preview-job-store";

interface SweeperLogger {
  log(message: string): void;
  error(message: string): void;
}

/** Redis surface the sweeper needs for its multi-replica lease (`SET key v NX PX`). */
export interface SweeperRedis {
  set(
    key: string,
    value: string,
    modePx: "PX",
    ttlMs: number,
    modeNx: "NX"
  ): Promise<string | null>;
}

export interface PreviewJobTimeoutSweeperOptions {
  store: Pick<
    RedisPreviewJobStore,
    "listActiveJobIds" | "findById" | "markFailed" | "expireOldJobs"
  >;
  redis: SweeperRedis;
  intervalMs: number;
  now?: () => Date;
  logger?: SweeperLogger;
  leaseKey?: string;
  leaseToken?: () => string;
}

const DEFAULT_LEASE_KEY = "preview-job:sweep:lock";

/**
 * Enforces the 5-minute job timeout from outside the worker: a crashed worker
 * cannot mark its own job failed, so the API process periodically scans active
 * jobs and fails any that have stalled. A short Redis lease keeps multiple API
 * replicas from sweeping the same tick.
 */
export class PreviewJobTimeoutSweeper {
  private readonly store: PreviewJobTimeoutSweeperOptions["store"];
  private readonly redis: SweeperRedis;
  private readonly intervalMs: number;
  private readonly now: () => Date;
  private readonly logger: SweeperLogger;
  private readonly leaseKey: string;
  private readonly leaseToken: () => string;
  private timer: ReturnType<typeof setInterval> | undefined;

  constructor({
    store,
    redis,
    intervalMs,
    now,
    logger,
    leaseKey,
    leaseToken
  }: PreviewJobTimeoutSweeperOptions) {
    this.store = store;
    this.redis = redis;
    this.intervalMs = intervalMs;
    this.now = now ?? (() => new Date());
    this.logger = logger ?? console;
    this.leaseKey = leaseKey ?? DEFAULT_LEASE_KEY;
    this.leaseToken = leaseToken ?? defaultLeaseToken;
  }

  start(): void {
    if (this.timer) {
      return;
    }
    this.timer = setInterval(() => {
      void this.runOnce().catch((error: unknown) => {
        this.logger.error(`timeout sweep error: ${asName(error)}`);
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
      if (hasPreviewJobTimedOut(job, at)) {
        await this.failTimedOut(job, at);
      }
    }
    await this.store.expireOldJobs(at);
  }

  private async failTimedOut(job: PreviewJob, at: Date): Promise<void> {
    await this.store.markFailed(job.id, timeoutFailureForJob(job), at);
    this.logger.error(`${job.id} failed code=PREVIEW_JOB_TIMEOUT stage=${job.stage}`);
  }

  private async acquireLease(): Promise<boolean> {
    // Lease lives ~80% of the interval so it expires before the next tick,
    // letting any replica win the following sweep.
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
