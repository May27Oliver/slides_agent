import type { Provider } from "@nestjs/common";
import type IORedis from "ioredis";
import { FsPptxArtifactStore } from "@/modules/pptx-export-jobs/fs-pptx-artifact-store";
import { loadPptxQueueConfig } from "@/modules/pptx-export-jobs/queue.config";
import type { PptxQueueConfig } from "@/modules/pptx-export-jobs/queue.config";
import { RedisPptxExportJobStore } from "@/modules/pptx-export-jobs/redis-pptx-export-job-store";
import {
  PPTX_ARTIFACT_STORE,
  PPTX_EXPORT_JOB_STORE,
  PPTX_QUEUE_CONFIG
} from "@/modules/pptx-export-jobs/pptx-export-jobs.tokens";
import { REDIS_CONNECTION } from "@/infra/redis/redis.tokens";

/** Providers shared by the API and worker processes (mirrors preview-jobs). */
export const pptxQueueConfigProvider: Provider = {
  provide: PPTX_QUEUE_CONFIG,
  useFactory: (): PptxQueueConfig => loadPptxQueueConfig()
};

export const pptxExportJobStoreProvider: Provider = {
  provide: PPTX_EXPORT_JOB_STORE,
  useFactory: (redis: IORedis) => new RedisPptxExportJobStore({ redis }),
  inject: [REDIS_CONNECTION]
};

export const pptxArtifactStoreProvider: Provider = {
  provide: PPTX_ARTIFACT_STORE,
  useFactory: (config: PptxQueueConfig) => new FsPptxArtifactStore(config.artifactDir),
  inject: [PPTX_QUEUE_CONFIG]
};
