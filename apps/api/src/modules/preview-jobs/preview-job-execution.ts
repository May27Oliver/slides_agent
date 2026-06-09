import type {
  DeckStore,
  JobStage,
  PreviewJob,
  PreviewJobStore,
  PreviewResult
} from "@slides-agent/domain";
import {
  createDeckFromPreviewResult,
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
  /**
   * Optional deck persistence (feature 006). When present and the job carries an
   * accountId, a successful result is also saved as a deck. Persistence failure
   * is logged but never turns a successful generation into a failure.
   */
  deckStore?: DeckStore;
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
  logger = console,
  deckStore
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
    const previewResult = toPreviewResult(result);
    // 010: persist BEFORE marking succeeded so the deckId is available atomically when
    // the client first sees "succeeded" (enables auto-navigation into the editor). Still
    // best-effort — a persistence failure yields a null deckId, not a job failure.
    const deckId = await persistDeck({ deckStore, job, previewResult, logger });
    await store.markSucceeded(job.id, { ...previewResult, deckId }, now());
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

/**
 * Persist a successful result as a deck for the owning account. Best-effort: a DB
 * failure is logged but does not change the job's succeeded outcome (006 DR-006).
 */
async function persistDeck({
  deckStore,
  job,
  previewResult,
  logger
}: {
  deckStore: DeckStore | undefined;
  job: PreviewJob;
  previewResult: PreviewResult;
  logger: PreviewJobLogger;
}): Promise<string | null> {
  const accountId = job.request.accountId;
  if (!deckStore || !accountId) {
    return null;
  }
  try {
    const { deckId } = await deckStore.saveNewDeck(
      createDeckFromPreviewResult({
        accountId,
        request: job.request,
        result: previewResult,
        sourceJobId: job.id
      })
    );
    logger.log(`${job.id} deck_persisted account=${accountId} deck=${deckId}`);
    return deckId;
  } catch {
    logger.error(`${job.id} deck_persist_failed`);
    return null;
  }
}

class PreviewJobTimeoutHandled extends Error {}

function toPreviewResult(result: GeneratePreviewResponseContract): PreviewResult {
  return {
    slideDeck: result.slideDeck,
    designPlanningResult: result.designPlanningResult,
    previewArtifact: result.previewArtifact,
    // 010 (C1/FR-006a): carry chart intents through to persistence.
    chartIntents: result.chartIntents
  };
}
