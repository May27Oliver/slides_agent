import type {
  JobFailure,
  JobStage,
  PreviewJob,
  PreviewJobStore,
  PreviewResult
} from "@slides-agent/domain";
import { PreviewJobService } from "@slides-agent/domain";
import { Injectable, type OnApplicationBootstrap, type OnModuleDestroy } from "@nestjs/common";

const SWEEP_INTERVAL_MS = 60_000;

@Injectable()
export class InMemoryPreviewJobStore
  implements PreviewJobStore, OnApplicationBootstrap, OnModuleDestroy
{
  private readonly jobs = new Map<string, PreviewJob>();
  private readonly lifecycle = new PreviewJobService();
  private sweepTimer: ReturnType<typeof setInterval> | undefined;

  // Periodically reclaim memory from finished/expired jobs. Started by Nest at
  // app bootstrap (not when unit tests `new` the store), and unref'd so it never
  // keeps the process alive.
  onApplicationBootstrap(): void {
    this.sweepTimer = setInterval(() => {
      void this.expireOldJobs(new Date());
    }, SWEEP_INTERVAL_MS);
    this.sweepTimer.unref?.();
  }

  onModuleDestroy(): void {
    if (this.sweepTimer) {
      clearInterval(this.sweepTimer);
      this.sweepTimer = undefined;
    }
  }

  async create(job: PreviewJob): Promise<PreviewJob> {
    this.jobs.set(job.id, job);
    return job;
  }

  async findById(jobId: string): Promise<PreviewJob | undefined> {
    return this.jobs.get(jobId);
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

  async expireOldJobs(at: Date): Promise<PreviewJob[]> {
    const expired: PreviewJob[] = [];

    for (const job of this.jobs.values()) {
      // Jobs already surfaced as "expired" on a previous sweep are reclaimed now,
      // so the Map (and the heavy result/HTML payloads it holds) cannot grow without bound.
      if (job.status === "expired") {
        this.jobs.delete(job.id);
        continue;
      }
      if ((job.status === "succeeded" || job.status === "failed") && job.expiresAt <= at) {
        const expiredJob: PreviewJob = {
          ...job,
          status: "expired",
          updatedAt: at,
          evidence: {
            ...job.evidence,
            finalStatus: "expired"
          }
        };
        this.jobs.set(job.id, expiredJob);
        expired.push(expiredJob);
      }
    }

    return expired;
  }

  private async update(
    jobId: string,
    updateJob: (job: PreviewJob) => PreviewJob
  ): Promise<PreviewJob | undefined> {
    const job = this.jobs.get(jobId);
    if (!job) {
      return undefined;
    }

    const updated = updateJob(job);
    this.jobs.set(jobId, updated);
    return updated;
  }
}
