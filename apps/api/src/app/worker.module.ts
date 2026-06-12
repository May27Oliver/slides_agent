import { Module } from "@nestjs/common";
import { RedisModule } from "@/infra/redis/redis.module";
import { DbModule } from "@/infra/db/db.module";
import { SlidesModule } from "@/modules/slides/slides.module";
import { PreviewWorkerRuntime } from "@/modules/preview-jobs/preview-worker.runtime";
import { DrizzleDeckStore } from "@/modules/decks/drizzle-deck-store";
import { DECK_STORE } from "@/modules/decks/decks.tokens";
import {
  previewJobStoreProvider,
  queueConfigProvider
} from "@/modules/preview-jobs/preview-jobs.providers";
import { PlaywrightSlideScreenshotter } from "@/modules/pptx-export-jobs/playwright-slide-screenshotter";
import { PptxExportWorkerRuntime } from "@/modules/pptx-export-jobs/pptx-export-worker.runtime";
import { PPTX_BROWSER_FACTORY } from "@/modules/pptx-export-jobs/pptx-export-jobs.tokens";
import {
  pptxArtifactStoreProvider,
  pptxExportJobStoreProvider,
  pptxQueueConfigProvider
} from "@/modules/pptx-export-jobs/pptx-export-jobs.providers";

/**
 * The worker process: shared Redis + DB infra + the slides generation capability
 * + the BullMQ consumer runtime and the job/deck stores it needs. It declares
 * only the shared preview-job providers (not the API-only producer queue,
 * controller, or timeout sweeper), and never starts the sweeper. The deck store
 * lets the worker persist a successful result to the owning account (006 US2).
 */
@Module({
  imports: [RedisModule, DbModule, SlidesModule],
  providers: [
    queueConfigProvider,
    previewJobStoreProvider,
    { provide: DECK_STORE, useClass: DrizzleDeckStore },
    PreviewWorkerRuntime,
    // 015 US2: the PPTX export consumer — chromium screenshots + pptx assembly.
    pptxQueueConfigProvider,
    pptxExportJobStoreProvider,
    pptxArtifactStoreProvider,
    { provide: PPTX_BROWSER_FACTORY, useClass: PlaywrightSlideScreenshotter },
    PptxExportWorkerRuntime
  ]
})
export class WorkerModule {}
