import type { Provider } from "@nestjs/common";
import type IORedis from "ioredis";
import { RedisPreviewJobStore } from "@/modules/preview-jobs/redis-preview-job-store";
import { loadQueueConfig } from "@/modules/preview-jobs/queue.config";
import type { QueueConfig } from "@/modules/preview-jobs/queue.config";
import { PREVIEW_JOB_STORE, QUEUE_CONFIG } from "@/modules/preview-jobs/preview-jobs.tokens";
import { REDIS_CONNECTION } from "@/infra/redis/redis.tokens";

/**
 * Providers shared by the API process (PreviewJobsModule) and the worker process
 * (WorkerModule): the job store and queue config are needed on both sides.
 * Declaring them once here keeps the wiring DRY without forcing the worker to
 * load the API-only producer/sweeper.
 */
export const queueConfigProvider: Provider = {
  provide: QUEUE_CONFIG,
  useFactory: (): QueueConfig => loadQueueConfig()
};

export const previewJobStoreProvider: Provider = {
  provide: PREVIEW_JOB_STORE,
  useFactory: (redis: IORedis) => new RedisPreviewJobStore({ redis }),
  inject: [REDIS_CONNECTION]
};
