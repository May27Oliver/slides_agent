import { Module } from "@nestjs/common";
import IORedis from "ioredis";
import { Queue } from "bullmq";
import { RedisModule } from "@/infra/redis/redis.module";
import { RedisService } from "@/infra/redis/redis.service";
import { REDIS_CONNECTION } from "@/infra/redis/redis.tokens";
import { SlidesModule } from "@/modules/slides/slides.module";
import { PreviewJobsController } from "@/modules/preview-jobs/preview-jobs.controller";
import { BullMqPreviewJobRunner } from "@/modules/preview-jobs/bullmq-preview-job-runner";
import { PreviewJobTimeoutSweeper } from "@/modules/preview-jobs/preview-job-timeout-sweeper";
import { RedisPreviewJobStore } from "@/modules/preview-jobs/redis-preview-job-store";
import type { QueueConfig } from "@/modules/preview-jobs/queue.config";
import {
  previewJobStoreProvider,
  queueConfigProvider
} from "@/modules/preview-jobs/preview-jobs.providers";
import {
  PREVIEW_JOB_QUEUE,
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
    // BullMQ producer connection is separate from the shared command connection
    // and must use maxRetriesPerRequest:null; derive it from the shared URL.
    {
      provide: PREVIEW_JOB_QUEUE,
      useFactory: (config: QueueConfig, redisService: RedisService) =>
        new Queue(config.queueName, {
          connection: new IORedis(redisService.redisUrl, { maxRetriesPerRequest: null })
        }),
      inject: [QUEUE_CONFIG, RedisService]
    },
    {
      provide: PREVIEW_JOB_RUNNER,
      useFactory: (queue: Queue) => new BullMqPreviewJobRunner({ queue }),
      inject: [PREVIEW_JOB_QUEUE]
    },
    // Out-of-worker 5-minute timeout enforcement. Started only by the API
    // process (see main.ts); the worker never starts it.
    {
      provide: PreviewJobTimeoutSweeper,
      useFactory: (store: RedisPreviewJobStore, redis: IORedis, config: QueueConfig) =>
        new PreviewJobTimeoutSweeper({
          store,
          redis,
          intervalMs: config.timeoutSweepIntervalMs
        }),
      inject: [PREVIEW_JOB_STORE, REDIS_CONNECTION, QUEUE_CONFIG]
    }
  ]
})
export class PreviewJobsModule {}
