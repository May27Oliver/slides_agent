import {
  Inject,
  Injectable,
  Logger,
  type OnApplicationBootstrap,
  type OnModuleDestroy
} from "@nestjs/common";
import type IORedis from "ioredis";
import { Worker } from "bullmq";
import type { DeckStore } from "@slides-agent/domain";
import { DECK_STORE } from "@/modules/decks/decks.tokens";
import { REDIS_CONNECTION } from "@/infra/redis/redis.tokens";
import type { PptxExportQueuePayload } from "@/modules/pptx-export-jobs/bullmq-pptx-export-job-runner";
import type { PptxArtifactStore } from "@/modules/pptx-export-jobs/fs-pptx-artifact-store";
import { runPptxExportJob } from "@/modules/pptx-export-jobs/pptx-export-job-execution";
import type { RedisPptxExportJobStore } from "@/modules/pptx-export-jobs/redis-pptx-export-job-store";
import type { SlideScreenshotter } from "@/modules/pptx-export-jobs/slide-screenshotter.port";
import type { PptxQueueConfig } from "@/modules/pptx-export-jobs/queue.config";
import {
  PPTX_ARTIFACT_STORE,
  PPTX_BROWSER_FACTORY,
  PPTX_EXPORT_JOB_STORE,
  PPTX_QUEUE_CONFIG
} from "@/modules/pptx-export-jobs/pptx-export-jobs.tokens";

/**
 * 015 US2: the BullMQ consumer for PPTX exports — worker process only (mirrors
 * PreviewWorkerRuntime). Concurrency stays at the queue config's default (1):
 * each export launches a chromium, so parallelism is a memory hazard, not a win.
 */
@Injectable()
export class PptxExportWorkerRuntime implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger("PptxExportWorker");
  private worker?: Worker<PptxExportQueuePayload>;
  private connection?: IORedis;

  constructor(
    @Inject(PPTX_QUEUE_CONFIG) private readonly config: PptxQueueConfig,
    @Inject(PPTX_EXPORT_JOB_STORE) private readonly store: RedisPptxExportJobStore,
    @Inject(PPTX_ARTIFACT_STORE) private readonly artifacts: PptxArtifactStore,
    @Inject(PPTX_BROWSER_FACTORY) private readonly screenshotter: SlideScreenshotter,
    @Inject(REDIS_CONNECTION) private readonly redis: IORedis,
    @Inject(DECK_STORE) private readonly deckStore: DeckStore
  ) {}

  onApplicationBootstrap(): void {
    this.connection = this.redis.duplicate({
      maxRetriesPerRequest: null,
      enableOfflineQueue: true
    });

    this.worker = new Worker<PptxExportQueuePayload>(
      this.config.queueName,
      async (bullJob) => {
        const { jobId } = bullJob.data;
        const job = await this.store.findById(jobId);
        if (!job) {
          this.logger.warn(`${jobId} not found in store; skipping`);
          return;
        }
        await runPptxExportJob({
          store: this.store,
          deckStore: this.deckStore,
          artifacts: this.artifacts,
          screenshotter: this.screenshotter,
          job,
          logger: this.logger
        });
      },
      { connection: this.connection, concurrency: this.config.workerConcurrency }
    );

    this.worker.on("failed", (bullJob, error) => {
      this.logger.error(`bull job ${bullJob?.id ?? "unknown"} failed: ${error.name}`);
    });

    this.logger.log(
      `PPTX export worker started queue=${this.config.queueName} concurrency=${this.config.workerConcurrency}`
    );
  }

  async onModuleDestroy(): Promise<void> {
    await this.worker?.close();
    await this.connection?.quit().catch(() => undefined);
  }
}
