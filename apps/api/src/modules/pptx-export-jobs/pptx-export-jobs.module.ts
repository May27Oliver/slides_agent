import { Logger, Module } from "@nestjs/common";
import type IORedis from "ioredis";
import { PPTX_EXPORT_JOB_TIMEOUT_MS } from "@slides-agent/domain";
import { RedisModule } from "@/infra/redis/redis.module";
import { REDIS_CONNECTION } from "@/infra/redis/redis.tokens";
import { DbModule } from "@/infra/db/db.module";
import { DECK_STORE } from "@/modules/decks/decks.tokens";
import { DrizzleDeckStore } from "@/modules/decks/drizzle-deck-store";
import { BullMqPptxExportJobRunner } from "@/modules/pptx-export-jobs/bullmq-pptx-export-job-runner";
import type { PptxArtifactStore } from "@/modules/pptx-export-jobs/fs-pptx-artifact-store";
import { PptxExportJobQueueService } from "@/modules/pptx-export-jobs/pptx-export-job-queue.service";
import { PptxExportJobTimeoutSweeper } from "@/modules/pptx-export-jobs/pptx-export-job-timeout-sweeper";
import { PptxExportJobsApiRuntime } from "@/modules/pptx-export-jobs/pptx-export-jobs-api.runtime";
import { PptxExportJobsController } from "@/modules/pptx-export-jobs/pptx-export-jobs.controller";
import type { RedisPptxExportJobStore } from "@/modules/pptx-export-jobs/redis-pptx-export-job-store";
import type { PptxQueueConfig } from "@/modules/pptx-export-jobs/queue.config";
import {
  pptxArtifactStoreProvider,
  pptxExportJobStoreProvider,
  pptxQueueConfigProvider
} from "@/modules/pptx-export-jobs/pptx-export-jobs.providers";
import {
  PPTX_ARTIFACT_STORE,
  PPTX_EXPORT_JOB_RUNNER,
  PPTX_EXPORT_JOB_STORE,
  PPTX_QUEUE_CONFIG
} from "@/modules/pptx-export-jobs/pptx-export-jobs.tokens";

// Artifacts must outlive their job slightly (download grace), never the reverse.
const ARTIFACT_MAX_AGE_MS = 2 * PPTX_EXPORT_JOB_TIMEOUT_MS + 30 * 60 * 1000;

/**
 * 015 US2: the API-process side of PPTX exports — accepts owner-scoped export
 * requests on the deck resource, persists job state to Redis, enqueues onto
 * BullMQ, exposes status polling + artifact download, and runs the timeout/
 * artifact-retention sweep. The worker side lives in WorkerModule.
 */
@Module({
  imports: [RedisModule, DbModule],
  controllers: [PptxExportJobsController],
  providers: [
    pptxQueueConfigProvider,
    pptxExportJobStoreProvider,
    pptxArtifactStoreProvider,
    { provide: DECK_STORE, useClass: DrizzleDeckStore },
    PptxExportJobQueueService,
    {
      provide: PPTX_EXPORT_JOB_RUNNER,
      useFactory: (queueService: PptxExportJobQueueService) =>
        new BullMqPptxExportJobRunner({ queue: queueService.queue }),
      inject: [PptxExportJobQueueService]
    },
    {
      provide: PptxExportJobTimeoutSweeper,
      useFactory: (
        store: RedisPptxExportJobStore,
        artifacts: PptxArtifactStore,
        redis: IORedis,
        config: PptxQueueConfig
      ) =>
        new PptxExportJobTimeoutSweeper({
          store,
          artifacts,
          redis,
          intervalMs: config.timeoutSweepIntervalMs,
          artifactMaxAgeMs: ARTIFACT_MAX_AGE_MS,
          logger: new Logger("PptxExportJobTimeoutSweeper")
        }),
      inject: [PPTX_EXPORT_JOB_STORE, PPTX_ARTIFACT_STORE, REDIS_CONNECTION, PPTX_QUEUE_CONFIG]
    },
    PptxExportJobsApiRuntime
  ]
})
export class PptxExportJobsModule {}
