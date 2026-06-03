import type {
  JobFailure,
  JobStage,
  PreviewJob,
  PreviewJobStore,
  PreviewResult
} from "@slides-agent/domain";
import {
  PreviewJobService,
  deserializePreviewJob,
  isTerminalJobStatus,
  serializePreviewJob
} from "@slides-agent/domain";

/**
 * Minimal structural view of the Redis commands this store uses. Both a real
 * ioredis client and ioredis-mock satisfy it, which keeps the store decoupled
 * from the concrete driver and trivially testable.
 */
export interface RedisLike {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, mode: "PX", ttlMs: number): Promise<unknown>;
  del(...keys: string[]): Promise<number>;
  sadd(key: string, member: string): Promise<number>;
  srem(key: string, member: string): Promise<number>;
  smembers(key: string): Promise<string[]>;
}

export interface RedisPreviewJobStoreOptions {
  redis: RedisLike;
  keyPrefix?: string;
  /** Extra lifetime added on top of `expiresAt` so review reads survive briefly past expiry. */
  ttlBufferMs?: number;
  now?: () => Date;
}

const DEFAULT_KEY_PREFIX = "preview-job";
const DEFAULT_TTL_BUFFER_MS = 60 * 1000;

/**
 * Thrown when the store cannot reach Redis. The message is deliberately generic
 * so callers can surface it without leaking connection details (host, port).
 */
export class PreviewJobStoreUnavailableError extends Error {
  constructor() {
    super("Preview job store is unavailable.");
    this.name = "PreviewJobStoreUnavailableError";
  }
}

export class RedisPreviewJobStore implements PreviewJobStore {
  private readonly redis: RedisLike;
  private readonly prefix: string;
  private readonly ttlBufferMs: number;
  private readonly now: () => Date;
  private readonly lifecycle = new PreviewJobService();

  constructor({ redis, keyPrefix, ttlBufferMs, now }: RedisPreviewJobStoreOptions) {
    this.redis = redis;
    this.prefix = keyPrefix ?? DEFAULT_KEY_PREFIX;
    this.ttlBufferMs = ttlBufferMs ?? DEFAULT_TTL_BUFFER_MS;
    this.now = now ?? (() => new Date());
  }

  async create(job: PreviewJob): Promise<PreviewJob> {
    try {
      await this.writeJob(job);
      if (!isTerminalJobStatus(job.status)) {
        await this.redis.sadd(this.activeKey(), job.id);
      }
      return job;
    } catch (error) {
      if (error instanceof PreviewJobStoreUnavailableError) {
        throw error;
      }
      // Wrap low-level Redis errors so connection details never reach callers.
      throw new PreviewJobStoreUnavailableError();
    }
  }

  async findById(jobId: string): Promise<PreviewJob | undefined> {
    const raw = await this.redis.get(this.jobKey(jobId));
    return raw ? deserializePreviewJob(raw) : undefined;
  }

  async markRunning(jobId: string, stage: JobStage, at: Date): Promise<PreviewJob | undefined> {
    return this.update(jobId, (job) => this.lifecycle.markRunning(job, stage, at));
  }

  async markStage(jobId: string, stage: JobStage, at: Date): Promise<PreviewJob | undefined> {
    return this.update(jobId, (job) => this.lifecycle.markStage(job, stage, at));
  }

  async markSucceeded(
    jobId: string,
    result: PreviewResult,
    at: Date
  ): Promise<PreviewJob | undefined> {
    return this.update(jobId, (job) => this.lifecycle.markSucceeded(job, result, at));
  }

  async markFailed(jobId: string, failure: JobFailure, at: Date): Promise<PreviewJob | undefined> {
    return this.update(jobId, (job) => this.lifecycle.markFailed(job, failure, at));
  }

  /** Active = non-terminal jobs the timeout sweeper must watch. */
  async listActiveJobIds(): Promise<string[]> {
    return this.redis.smembers(this.activeKey());
  }

  async expireOldJobs(_at: Date): Promise<PreviewJob[]> {
    // Terminal jobs are reclaimed by their TTL, so this only reconciles the
    // active set: drop ids whose job key has vanished or that already reached a
    // terminal state (the latter should not normally remain in the set).
    const reconciled: PreviewJob[] = [];
    for (const id of await this.listActiveJobIds()) {
      const job = await this.findById(id);
      if (!job) {
        await this.redis.srem(this.activeKey(), id);
        continue;
      }
      if (isTerminalJobStatus(job.status)) {
        await this.redis.srem(this.activeKey(), id);
        reconciled.push(job);
      }
    }
    return reconciled;
  }

  private async update(
    jobId: string,
    transition: (job: PreviewJob) => PreviewJob
  ): Promise<PreviewJob | undefined> {
    // Read-modify-write guarded by the domain terminal check: lifecycle.markX
    // returns the same reference for a terminal job, so we never resurrect one.
    // BullMQ serializes a job's worker writes; the sweeper only fires post-timeout,
    // so contention is negligible for this internal tool.
    const job = await this.findById(jobId);
    if (!job) {
      return undefined;
    }

    const updated = transition(job);
    if (updated === job) {
      return job;
    }

    await this.writeJob(updated);
    if (isTerminalJobStatus(updated.status)) {
      await this.redis.srem(this.activeKey(), updated.id);
    }
    return updated;
  }

  private async writeJob(job: PreviewJob): Promise<void> {
    await this.redis.set(this.jobKey(job.id), JSON.stringify(serializePreviewJob(job)), "PX", this.ttlFor(job));
  }

  private ttlFor(job: PreviewJob): number {
    const remaining = job.expiresAt.getTime() - this.now().getTime();
    return Math.max(remaining, 1000) + this.ttlBufferMs;
  }

  private jobKey(jobId: string): string {
    return `${this.prefix}:${jobId}`;
  }

  private activeKey(): string {
    return `${this.prefix}:active`;
  }
}
