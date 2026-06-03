import type { JobStage, PreviewJob, PreviewJobRunner, PreviewJobStore } from "@slides-agent/domain";
import {
  createGenerationFailure,
  createTimeoutFailure,
  hasPreviewJobTimedOut
} from "@slides-agent/domain";
import type { GeneratePreviewResponseContract } from "@slides-agent/contracts";
import { Logger } from "@nestjs/common";
import type { SlidesService } from "@/modules/slides/slides.service";

interface PreviewJobLogger {
  log(message: string): void;
  error(message: string): void;
}

export interface InProcessPreviewJobRunnerOptions {
  store: PreviewJobStore;
  slidesService: Pick<SlidesService, "generatePreview">;
  now?: () => Date;
  logger?: PreviewJobLogger;
}

export class InProcessPreviewJobRunner implements PreviewJobRunner {
  private readonly store: PreviewJobStore;
  private readonly slidesService: Pick<SlidesService, "generatePreview">;
  private readonly now: () => Date;
  private readonly logger: PreviewJobLogger;

  constructor({ store, slidesService, now, logger }: InProcessPreviewJobRunnerOptions) {
    this.store = store;
    this.slidesService = slidesService;
    this.now = now ?? (() => new Date());
    this.logger = logger ?? new Logger("PreviewJobs");
  }

  start(job: PreviewJob): void {
    this.logger.log(`${job.id} started`);
    void this.run(job);
  }

  async run(job: PreviewJob): Promise<void> {
    let currentStage: JobStage = "content_planning";

    try {
      const result = await this.slidesService.generatePreview(job.request, {
        onStage: async (stage) => {
          currentStage = stage;
          const updated =
            stage === "content_planning"
              ? await this.store.markRunning(job.id, stage, this.now())
              : await this.store.markStage(job.id, stage, this.now());
          this.logStage(job.id, stage);

          if (updated && hasPreviewJobTimedOut(updated, this.now())) {
            const failure = createTimeoutFailure(stage);
            await this.store.markFailed(job.id, failure, this.now());
            this.logger.error(`${job.id} failed code=${failure.code} stage=${stage}`);
            throw new PreviewJobTimeoutHandled();
          }
        }
      });
      await this.store.markSucceeded(job.id, previewResult(result), this.now());
      this.logger.log(`${job.id} succeeded`);
    } catch (error) {
      if (error instanceof PreviewJobTimeoutHandled) {
        return;
      }

      const failure = createGenerationFailure(error, currentStage);
      await this.store.markFailed(job.id, failure, this.now());
      this.logger.error(`${job.id} failed code=${failure.code} stage=${currentStage}`);
    }
  }

  private logStage(jobId: string, stage: JobStage): void {
    this.logger.log(`${jobId} stage=${stage} status=running`);
  }
}

class PreviewJobTimeoutHandled extends Error {}

function previewResult(result: GeneratePreviewResponseContract) {
  return {
    slideDeck: result.slideDeck,
    designPlanningResult: result.designPlanningResult,
    previewArtifact: result.previewArtifact
  };
}
