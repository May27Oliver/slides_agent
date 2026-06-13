import type {
  CreatePptxExportJobResult,
  PptxExportFailure,
  PptxExportJob,
  PptxExportJobStore,
  PptxExportResult
} from "@slides-agent/domain";
import {
  PptxExportJobService,
  deserializePptxExportJob,
  isTerminalPptxStatus,
  serializePptxExportJob
} from "@slides-agent/domain";
import type { RedisLike } from "@/modules/preview-jobs/redis-preview-job-store";

export interface RedisPptxExportJobStoreOptions {
  redis: RedisLike;
  keyPrefix?: string;
  ttlBufferMs?: number;
  now?: () => Date;
}

const DEFAULT_KEY_PREFIX = "pptx-export-job";
const DEFAULT_TTL_BUFFER_MS = 60 * 1000;

/** Sanitized store failure — never leaks Redis connection details. */
export class PptxExportJobStoreUnavailableError extends Error {
  constructor() {
    super("PPTX export job store is unavailable.");
    this.name = "PptxExportJobStoreUnavailableError";
  }
}

/**
 * 015 US2: Redis-backed job store, mirroring RedisPreviewJobStore — JSON value
 * with TTL per job + an active-id set for the sweeper and the single-flight gate.
 */
export class RedisPptxExportJobStore implements PptxExportJobStore {
  private readonly redis: RedisLike;
  private readonly prefix: string;
  private readonly ttlBufferMs: number;
  private readonly now: () => Date;
  private readonly lifecycle = new PptxExportJobService();

  constructor({ redis, keyPrefix, ttlBufferMs, now }: RedisPptxExportJobStoreOptions) {
    this.redis = redis;
    this.prefix = keyPrefix ?? DEFAULT_KEY_PREFIX;
    this.ttlBufferMs = ttlBufferMs ?? DEFAULT_TTL_BUFFER_MS;
    this.now = now ?? (() => new Date());
  }

  /**
   * FR-006 single-flight, made atomic via a per-account NX lock. SET NX is atomic,
   * so two concurrent creates cannot both acquire the lock — the loser reads back the
   * winner's job as the conflict. The lock self-heals: its TTL tracks the job's, and
   * every terminal transition / expiry releases it (see `update` / `expireOldJobs`).
   */
  async createIfNoActive(job: PptxExportJob): Promise<CreatePptxExportJobResult> {
    // Two attempts at most: the first may lose to a stale orphan lock (job already
    // gone but lock lingering after a crash); we clear it and retry exactly once.
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const acquired = await this.guarded(() =>
        this.redis.set(this.accountLockKey(job.accountId), job.id, "PX", this.ttlFor(job), "NX")
      );
      if (acquired === "OK") {
        // Lock taken — write the job and index it. If either step fails, roll back so
        // we never leak the lock (account stuck until TTL) or leave a queued job with
        // no active-set tracking. Best-effort cleanup, then surface the original error.
        try {
          await this.writeJob(job);
          await this.guarded(() => this.redis.sadd(this.activeKey(), job.id));
        } catch (error) {
          await this.guarded(() =>
            this.redis.del(this.jobKey(job.id), this.accountLockKey(job.accountId))
          ).catch(() => undefined);
          throw error;
        }
        return { ok: true, job };
      }
      const active = await this.findActiveByAccount(job.accountId);
      if (active) {
        return { ok: false, active };
      }
      // Lock held but no live job: orphaned. Clear and let the next loop re-acquire.
      await this.guarded(() => this.redis.del(this.accountLockKey(job.accountId)));
    }
    // Both attempts lost the lock yet found no live job — treat as transient.
    throw new PptxExportJobStoreUnavailableError();
  }

  async findById(jobId: string): Promise<PptxExportJob | undefined> {
    const raw = await this.guarded(() => this.redis.get(this.jobKey(jobId)));
    return raw ? deserializePptxExportJob(raw) : undefined;
  }

  async listActiveJobIds(): Promise<string[]> {
    return this.guarded(() => this.redis.smembers(this.activeKey()));
  }

  /** The conflicting in-flight job for an account (FR-006), used by createIfNoActive. */
  private async findActiveByAccount(accountId: string): Promise<PptxExportJob | undefined> {
    for (const id of await this.listActiveJobIds()) {
      const job = await this.findById(id);
      if (job && job.accountId === accountId && !isTerminalPptxStatus(job.status)) {
        return job;
      }
    }
    return undefined;
  }

  async markProcessing(jobId: string, at: Date): Promise<PptxExportJob | undefined> {
    return this.update(jobId, (job) => this.lifecycle.markProcessing(job, at));
  }

  async markDone(
    jobId: string,
    result: PptxExportResult,
    at: Date
  ): Promise<PptxExportJob | undefined> {
    return this.update(jobId, (job) => this.lifecycle.markDone(job, result, at));
  }

  async markFailed(
    jobId: string,
    failure: PptxExportFailure,
    at: Date
  ): Promise<PptxExportJob | undefined> {
    return this.update(jobId, (job) => this.lifecycle.markFailed(job, failure, at));
  }

  async expireOldJobs(_at: Date): Promise<PptxExportJob[]> {
    const reconciled: PptxExportJob[] = [];
    for (const id of await this.listActiveJobIds()) {
      const job = await this.findById(id);
      if (!job) {
        await this.guarded(() => this.redis.srem(this.activeKey(), id));
        continue;
      }
      if (isTerminalPptxStatus(job.status)) {
        await this.guarded(() => this.redis.srem(this.activeKey(), id));
        await this.releaseAccountLock(job);
        reconciled.push(job);
      }
    }
    return reconciled;
  }

  private async update(
    jobId: string,
    transition: (job: PptxExportJob) => PptxExportJob
  ): Promise<PptxExportJob | undefined> {
    const job = await this.findById(jobId);
    if (!job) {
      return undefined;
    }
    const updated = transition(job);
    if (updated === job) {
      return job;
    }
    await this.writeJob(updated);
    if (isTerminalPptxStatus(updated.status)) {
      await this.guarded(() => this.redis.srem(this.activeKey(), updated.id));
      await this.releaseAccountLock(updated);
    }
    return updated;
  }

  /** Frees the per-account single-flight lock so the next export can be created. */
  private async releaseAccountLock(job: PptxExportJob): Promise<void> {
    await this.guarded(() => this.redis.del(this.accountLockKey(job.accountId)));
  }

  private async guarded<T>(op: () => Promise<T>): Promise<T> {
    try {
      return await op();
    } catch (error) {
      if (error instanceof PptxExportJobStoreUnavailableError) {
        throw error;
      }
      throw new PptxExportJobStoreUnavailableError();
    }
  }

  private async writeJob(job: PptxExportJob): Promise<void> {
    await this.guarded(() =>
      this.redis.set(
        this.jobKey(job.id),
        JSON.stringify(serializePptxExportJob(job)),
        "PX",
        this.ttlFor(job)
      )
    );
  }

  private ttlFor(job: PptxExportJob): number {
    const remaining = job.expiresAt.getTime() - this.now().getTime();
    return Math.max(remaining, 1000) + this.ttlBufferMs;
  }

  private jobKey(jobId: string): string {
    return `${this.prefix}:${jobId}`;
  }

  private activeKey(): string {
    return `${this.prefix}:active`;
  }

  /** Per-account single-flight lock (FR-006); SET NX on this key gates concurrent creates. */
  private accountLockKey(accountId: string): string {
    return `${this.prefix}:account-lock:${accountId}`;
  }
}
