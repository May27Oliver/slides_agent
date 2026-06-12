import type { JobsOptions } from "bullmq";
import type { PptxExportJob, PptxExportJobRunner } from "@slides-agent/domain";

/** Queue payload: only the id — the job's state lives in the Redis store. */
export interface PptxExportQueuePayload {
  jobId: string;
}

export interface PptxQueueLike {
  add(name: string, data: PptxExportQueuePayload, opts?: JobsOptions): Promise<unknown>;
}

const DEFAULT_JOB_NAME = "export-pptx";

// Mirror the preview runner: the Redis store is the source of truth, so BullMQ's
// own records are reclaimed aggressively; failures become `failed` jobs the user
// retries by creating a new export (attempts: 1).
const JOB_OPTIONS: JobsOptions = {
  attempts: 1,
  removeOnComplete: true,
  removeOnFail: { count: 100 }
};

export class BullMqPptxExportJobRunner implements PptxExportJobRunner {
  private readonly queue: PptxQueueLike;
  private readonly jobName: string;

  constructor({ queue, jobName }: { queue: PptxQueueLike; jobName?: string }) {
    this.queue = queue;
    this.jobName = jobName ?? DEFAULT_JOB_NAME;
  }

  async start(job: PptxExportJob): Promise<void> {
    await this.queue.add(this.jobName, { jobId: job.id }, JOB_OPTIONS);
  }
}
