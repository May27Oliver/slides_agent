import { Logger, Module } from "@nestjs/common";
import IORedis from "ioredis";
import { Queue } from "bullmq";
import { DeckOutlinePlanningAdapter } from "@/adapters/llm/deck-outline-planning.adapter";
import { OpenAiResponsesClient } from "@/adapters/llm/openai-responses.client";
import type { LlmCompletionClient } from "@/adapters/llm/openai-responses.client";
import { SemanticSegmentationAdapter } from "@/adapters/llm/semantic-segmentation.adapter";
import { UiUxProMaxDesignPlanningAdapter } from "@/adapters/ui-ux-pro-max/ui-ux-pro-max.adapter";
import {
  designPlanningModel,
  loadLlmRuntimeConfig,
  semanticSegmentationModel
} from "@/config/llm.config";
import type { LlmRuntimeConfig } from "@/config/llm.config";
import { SlidesController } from "@/modules/slides/slides.controller";
import { BullMqPreviewJobRunner } from "@/modules/slides/bullmq-preview-job-runner";
import { RedisPreviewJobStore } from "@/modules/slides/redis-preview-job-store";
import { PreviewJobTimeoutSweeper } from "@/modules/slides/preview-job-timeout-sweeper";
import { loadQueueConfig } from "@/modules/slides/queue.config";
import type { QueueConfig } from "@/modules/slides/queue.config";
import { SlidesService } from "@/modules/slides/slides.service";
import {
  DECK_OUTLINE_PLANNING_PORT,
  DESIGN_PLANNING_PORT,
  LLM_COMPLETION_CLIENT,
  LLM_RUNTIME_CONFIG,
  PREVIEW_JOB_QUEUE,
  PREVIEW_JOB_RUNNER,
  PREVIEW_JOB_STORE,
  QUEUE_CONFIG,
  REDIS_CONNECTION,
  SEMANTIC_SEGMENTATION_ADAPTER,
  SEMANTIC_SEGMENTATION_REPAIRER_PORT,
  SEMANTIC_SEGMENTER_PORT
} from "@/modules/slides/slides.tokens";

const logger = new Logger("SlidesModule");

@Module({
  controllers: [SlidesController],
  providers: [
    SlidesService,
    // Backend-only queue configuration. Throws at startup if REDIS_URL is
    // missing — the async preview-job path requires Redis (fail-fast).
    {
      provide: QUEUE_CONFIG,
      useFactory: (): QueueConfig => loadQueueConfig()
    },
    // Shared connection for the job store + timeout sweeper (regular commands).
    // enableOfflineQueue:false makes commands reject promptly when Redis is
    // down, so job creation fails fast instead of hanging.
    {
      provide: REDIS_CONNECTION,
      useFactory: (config: QueueConfig) =>
        new IORedis(config.redisUrl, {
          maxRetriesPerRequest: 3,
          enableOfflineQueue: false
        }),
      inject: [QUEUE_CONFIG]
    },
    // BullMQ queue connection is separate and must use maxRetriesPerRequest:null.
    {
      provide: PREVIEW_JOB_QUEUE,
      useFactory: (config: QueueConfig) =>
        new Queue(config.queueName, {
          connection: new IORedis(config.redisUrl, { maxRetriesPerRequest: null })
        }),
      inject: [QUEUE_CONFIG]
    },
    {
      provide: PREVIEW_JOB_STORE,
      useFactory: (redis: IORedis) => new RedisPreviewJobStore({ redis }),
      inject: [REDIS_CONNECTION]
    },
    {
      provide: PREVIEW_JOB_RUNNER,
      useFactory: (queue: Queue) => new BullMqPreviewJobRunner({ queue }),
      inject: [PREVIEW_JOB_QUEUE]
    },
    // Out-of-worker 5-minute timeout enforcement: a crashed worker cannot mark
    // its own job failed, so the API process sweeps stalled jobs. Multi-replica
    // safe via a Redis lease.
    {
      provide: PreviewJobTimeoutSweeper,
      useFactory: (store: RedisPreviewJobStore, redis: IORedis, config: QueueConfig) =>
        new PreviewJobTimeoutSweeper({
          store,
          redis,
          intervalMs: config.timeoutSweepIntervalMs
        }),
      inject: [PREVIEW_JOB_STORE, REDIS_CONNECTION, QUEUE_CONFIG]
    },
    {
      provide: LLM_RUNTIME_CONFIG,
      useFactory: () => loadLlmRuntimeConfig()
    },
    {
      provide: LLM_COMPLETION_CLIENT,
      useFactory: (config: LlmRuntimeConfig): LlmCompletionClient | undefined => {
        if (!config.hasOpenAiApiKey) {
          logger.warn(
            "OPENAI_API_KEY is not configured; preview generation will use deterministic fallback paths."
          );
          return undefined;
        }

        return new OpenAiResponsesClient({ config });
      },
      inject: [LLM_RUNTIME_CONFIG]
    },
    {
      provide: SEMANTIC_SEGMENTATION_ADAPTER,
      useFactory: (
        config: LlmRuntimeConfig,
        client: LlmCompletionClient | undefined
      ): SemanticSegmentationAdapter | undefined => {
        const model = semanticSegmentationModel(config);
        return client
          ? new SemanticSegmentationAdapter({
              client,
              ...(model ? { model } : {})
            })
          : undefined;
      },
      inject: [LLM_RUNTIME_CONFIG, LLM_COMPLETION_CLIENT]
    },
    {
      provide: SEMANTIC_SEGMENTER_PORT,
      useExisting: SEMANTIC_SEGMENTATION_ADAPTER
    },
    {
      provide: SEMANTIC_SEGMENTATION_REPAIRER_PORT,
      useExisting: SEMANTIC_SEGMENTATION_ADAPTER
    },
    {
      provide: DECK_OUTLINE_PLANNING_PORT,
      useFactory: (
        config: LlmRuntimeConfig,
        client: LlmCompletionClient | undefined
      ): DeckOutlinePlanningAdapter | undefined => {
        const model = config.defaultModel;
        return client
          ? new DeckOutlinePlanningAdapter({
              client,
              ...(model ? { model } : {})
            })
          : undefined;
      },
      inject: [LLM_RUNTIME_CONFIG, LLM_COMPLETION_CLIENT]
    },
    {
      provide: DESIGN_PLANNING_PORT,
      useFactory: (
        config: LlmRuntimeConfig,
        client: LlmCompletionClient | undefined
      ): UiUxProMaxDesignPlanningAdapter | undefined => {
        const model = designPlanningModel(config);
        return client
          ? new UiUxProMaxDesignPlanningAdapter({
              client,
              ...(model ? { model } : {})
            })
          : undefined;
      },
      inject: [LLM_RUNTIME_CONFIG, LLM_COMPLETION_CLIENT]
    }
  ]
})
export class SlidesModule {}
