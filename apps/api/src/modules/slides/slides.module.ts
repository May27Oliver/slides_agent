import { Logger, Module } from "@nestjs/common";
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
import { SlidesService } from "@/modules/slides/slides.service";
import {
  DECK_OUTLINE_PLANNING_PORT,
  DESIGN_PLANNING_PORT,
  LLM_COMPLETION_CLIENT,
  LLM_RUNTIME_CONFIG,
  SEMANTIC_SEGMENTATION_ADAPTER,
  SEMANTIC_SEGMENTATION_REPAIRER_PORT,
  SEMANTIC_SEGMENTER_PORT
} from "@/modules/slides/slides.tokens";

const logger = new Logger("SlidesModule");

/**
 * The slides generation capability: the SlidesService pipeline plus its
 * backend-configured LLM adapters. It owns no transport and no async-job
 * machinery — preview-jobs imports this module and calls SlidesService.
 */
@Module({
  providers: [
    SlidesService,
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
  ],
  exports: [SlidesService]
})
export class SlidesModule {}
