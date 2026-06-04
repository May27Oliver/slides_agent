import { Logger, Module } from "@nestjs/common";
import type IORedis from "ioredis";
import { RedisModule } from "@/infra/redis/redis.module";
import { REDIS_CONNECTION } from "@/infra/redis/redis.tokens";
import { SlidesModule } from "@/modules/slides/slides.module";
import { PreviewJobsController } from "@/modules/preview-jobs/preview-jobs.controller";
import { BullMqPreviewJobRunner } from "@/modules/preview-jobs/bullmq-preview-job-runner";
import { PreviewJobQueueService } from "@/modules/preview-jobs/preview-job-queue.service";
import { PreviewJobsApiRuntime } from "@/modules/preview-jobs/preview-jobs-api.runtime";
import { PreviewJobTimeoutSweeper } from "@/modules/preview-jobs/preview-job-timeout-sweeper";
import { RedisPreviewJobStore } from "@/modules/preview-jobs/redis-preview-job-store";
import type { QueueConfig } from "@/modules/preview-jobs/queue.config";
import {
  previewJobStoreProvider,
  queueConfigProvider
} from "@/modules/preview-jobs/preview-jobs.providers";
import {
  PREVIEW_JOB_RUNNER,
  PREVIEW_JOB_STORE,
  QUEUE_CONFIG
} from "@/modules/preview-jobs/preview-jobs.tokens";

/**
 * The async preview-job orchestration for the API process: accepts requests,
 * persists job state to Redis, enqueues onto BullMQ, exposes status polling, and
 * runs the out-of-worker timeout sweep. Depends on SlidesModule for the actual
 * generation (preview-jobs -> slides) and RedisModule for the shared connection.
 */
@Module({
  imports: [RedisModule, SlidesModule],
  controllers: [PreviewJobsController],
  providers: [
    queueConfigProvider,
    previewJobStoreProvider,
    // Owns the BullMQ producer Queue + its connection, with shutdown cleanup.
    PreviewJobQueueService,
    {
      provide: PREVIEW_JOB_RUNNER,
      useFactory: (queueService: PreviewJobQueueService) =>
        new BullMqPreviewJobRunner({ queue: queueService.queue }),
      inject: [PreviewJobQueueService]
    },
    // Out-of-worker 5-minute timeout enforcement, started/stopped via
    // PreviewJobsApiRuntime (API process only; the worker never starts it).
    {
      provide: PreviewJobTimeoutSweeper,
      useFactory: (store: RedisPreviewJobStore, redis: IORedis, config: QueueConfig) =>
        new PreviewJobTimeoutSweeper({
          store,
          redis,
          intervalMs: config.timeoutSweepIntervalMs,
          logger: new Logger("PreviewJobTimeoutSweeper")
        }),
      inject: [PREVIEW_JOB_STORE, REDIS_CONNECTION, QUEUE_CONFIG]
    },
    PreviewJobsApiRuntime
  ]
})
export class PreviewJobsModule {}
