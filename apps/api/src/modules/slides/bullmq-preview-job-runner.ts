import type { PreviewJob, PreviewJobRunner } from "@slides-agent/domain";

/** The single job payload carried on the queue: only the id (request lives in Redis). */
export interface PreviewJobQueuePayload {
  jobId: string;
}

/** Minimal structural view of a BullMQ Queue — keeps the runner testable. */
export interface QueueLike {
  add(
    name: string,
    data: PreviewJobQueuePayload,
    opts?: { attempts?: number }
  ): Promise<unknown>;
}

export interface BullMqPreviewJobRunnerOptions {
  queue: QueueLike;
  jobName?: string;
}

const DEFAULT_JOB_NAME = "generate";

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
    await this.queue.add(this.jobName, { jobId: job.id }, { attempts: 1 });
  }
}
