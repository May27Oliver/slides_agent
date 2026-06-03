import type { JobsOptions } from "bullmq";
import type { PreviewJob, PreviewJobRunner } from "@slides-agent/domain";

/** The single job payload carried on the queue: only the id (request lives in Redis). */
export interface PreviewJobQueuePayload {
  jobId: string;
}

/** Minimal structural view of a BullMQ Queue — keeps the runner testable. */
export interface QueueLike {
  add(name: string, data: PreviewJobQueuePayload, opts?: JobsOptions): Promise<unknown>;
}

export interface BullMqPreviewJobRunnerOptions {
  queue: QueueLike;
  jobName?: string;
}

const DEFAULT_JOB_NAME = "generate";

// Our Redis store is the source of truth for job state, so BullMQ's own job
// records can be reclaimed: drop completed records immediately, keep a bounded
// number of failed ones for operational debugging. Without this, BullMQ keys
// accumulate in Redis indefinitely.
const JOB_OPTIONS: JobsOptions = {
  attempts: 1,
  removeOnComplete: true,
  removeOnFail: { count: 100 }
};

/**
 * Enqueues accepted preview jobs onto BullMQ for a separate worker process to
 * consume. The API never runs generation itself. Retries are disabled
 * (`attempts: 1`): any failure becomes a `failed` job and the user re-submits.
 */
export class BullMqPreviewJobRunner implements PreviewJobRunner {
  private readonly queue: QueueLike;
  private readonly jobName: string;

  constructor({ queue, jobName }: BullMqPreviewJobRunnerOptions) {
    this.queue = queue;
    this.jobName = jobName ?? DEFAULT_JOB_NAME;
  }

  async start(job: PreviewJob): Promise<void> {
    await this.queue.add(this.jobName, { jobId: job.id }, JOB_OPTIONS);
  }
}
