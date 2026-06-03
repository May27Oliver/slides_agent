import { Inject, Injectable, Logger, type OnModuleDestroy } from "@nestjs/common";
import type IORedis from "ioredis";
import { Worker } from "bullmq";
import { SlidesService } from "@/modules/slides/slides.service";
import { runPreviewJobGeneration } from "@/modules/slides/preview-job-execution";
import type { RedisPreviewJobStore } from "@/modules/slides/redis-preview-job-store";
import type { PreviewJobQueuePayload } from "@/modules/slides/bullmq-preview-job-runner";
import type { QueueConfig } from "@/modules/slides/queue.config";
import { PREVIEW_JOB_STORE, QUEUE_CONFIG } from "@/modules/slides/slides.tokens";
import { REDIS_CONNECTION } from "@/infra/redis/redis.tokens";

/**
 * The BullMQ consumer side of the preview-job queue. Lives only in the worker
 * runtime (WorkerModule) — it is never wired into the API process, so HTTP
 * serving and generation stay in separate processes. Reuses the shared Redis
 * connection's URL to build a worker-specific connection (BullMQ workers require
 * `maxRetriesPerRequest: null`).
 */
@Injectable()
export class PreviewWorkerRuntime implements OnModuleDestroy {
  private readonly logger = new Logger("PreviewJobWorker");
  private worker?: Worker<PreviewJobQueuePayload>;
  private connection?: IORedis;

  constructor(
    @Inject(QUEUE_CONFIG) private readonly config: QueueConfig,
    @Inject(PREVIEW_JOB_STORE) private readonly store: RedisPreviewJobStore,
    @Inject(REDIS_CONNECTION) private readonly redis: IORedis,
    private readonly slidesService: SlidesService
  ) {}

  start(): void {
    // BullMQ worker connections must use maxRetriesPerRequest:null; derive one
    // from the shared connection so we don't re-read the environment.
    this.connection = this.redis.duplicate({
      maxRetriesPerRequest: null,
      enableOfflineQueue: true
    });

    this.worker = new Worker<PreviewJobQueuePayload>(
      this.config.queueName,
      async (bullJob) => {
        const { jobId } = bullJob.data;
        const job = await this.store.findById(jobId);
        if (!job) {
          this.logger.warn(`${jobId} not found in store; skipping`);
          return;
        }
        await runPreviewJobGeneration({
          store: this.store,
          slidesService: this.slidesService,
          job,
          logger: this.logger
        });
      },
      { connection: this.connection, concurrency: this.config.workerConcurrency }
    );

    this.worker.on("failed", (bullJob, error) => {
      // The job's user-facing failure is already sanitized in the store; this is
      // an internal operational log only.
      this.logger.error(`bull job ${bullJob?.id ?? "unknown"} failed: ${error.name}`);
    });

    this.logger.log(
      `Preview job worker started queue=${this.config.queueName} concurrency=${this.config.workerConcurrency}`
    );
  }

  async onModuleDestroy(): Promise<void> {
    await this.worker?.close();
    await this.connection?.quit().catch(() => undefined);
  }
}
