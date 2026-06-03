import type { JobStage, PreviewJob, PreviewJobStore } from "@slides-agent/domain";
import {
  createGenerationFailure,
  createTimeoutFailure,
  hasPreviewJobTimedOut
} from "@slides-agent/domain";
import type { GeneratePreviewResponseContract } from "@slides-agent/contracts";
import type { SlidesService } from "@/modules/slides/slides.service";

interface PreviewJobLogger {
  log(message: string): void;
  error(message: string): void;
}

export interface RunPreviewJobGenerationOptions {
  store: PreviewJobStore;
  slidesService: Pick<SlidesService, "generatePreview">;
  job: PreviewJob;
  now?: () => Date;
  logger?: PreviewJobLogger;
}

/**
 * Runs one accepted preview job through the existing 002 generation pipeline,
 * persisting stage transitions, the final result, or a sanitized failure to the
 * shared store. Extracted from 003's in-process runner so the BullMQ worker (and
 * tests) can reuse the exact same orchestration without an HTTP server.
 */
export async function runPreviewJobGeneration({
  store,
  slidesService,
  job,
  now = () => new Date(),
  logger = console
}: RunPreviewJobGenerationOptions): Promise<void> {
  let currentStage: JobStage = "content_planning";

  try {
    const result = await slidesService.generatePreview(job.request, {
      onStage: async (stage) => {
        currentStage = stage;
        const updated =
          stage === "content_planning"
            ? await store.markRunning(job.id, stage, now())
            : await store.markStage(job.id, stage, now());
        logger.log(`${job.id} stage=${stage} status=running`);

        if (updated && hasPreviewJobTimedOut(updated, now())) {
          const failure = createTimeoutFailure(stage);
          await store.markFailed(job.id, failure, now());
          logger.error(`${job.id} failed code=${failure.code} stage=${stage}`);
          throw new PreviewJobTimeoutHandled();
        }
      }
    });
    await store.markSucceeded(job.id, toPreviewResult(result), now());
  } catch (error) {
    if (error instanceof PreviewJobTimeoutHandled) {
      return;
    }

    const failure = createGenerationFailure(error, currentStage);
    await store.markFailed(job.id, failure, now());
    logger.error(`${job.id} failed code=${failure.code} stage=${currentStage}`);
    return;
  }

  logger.log(`${job.id} succeeded`);
}

class PreviewJobTimeoutHandled extends Error {}

function toPreviewResult(result: GeneratePreviewResponseContract) {
  return {
    slideDeck: result.slideDeck,
    designPlanningResult: result.designPlanningResult,
    previewArtifact: result.previewArtifact
  };
}
