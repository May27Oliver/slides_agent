import type { DeckStore, PptxExportJob } from "@slides-agent/domain";
import { createPptxExportFailure } from "@slides-agent/domain";
import type { PptxArtifactStore } from "@/modules/pptx-export-jobs/fs-pptx-artifact-store";
import { buildPptxFromImages } from "@/modules/pptx-export-jobs/pptx-builder";
import type { RedisPptxExportJobStore } from "@/modules/pptx-export-jobs/redis-pptx-export-job-store";
import type { SlideScreenshotter } from "@/modules/pptx-export-jobs/slide-screenshotter.port";

interface ExecutionLogger {
  log(message: string): void;
  error(message: string): void;
}

export interface RunPptxExportJobInput {
  store: Pick<RedisPptxExportJobStore, "markProcessing" | "markDone" | "markFailed">;
  deckStore: Pick<DeckStore, "findByIdForAccount">;
  artifacts: PptxArtifactStore;
  screenshotter: SlideScreenshotter;
  job: PptxExportJob;
  logger: ExecutionLogger;
  /** Per-slide animation settle before the shot; injectable for tests. */
  settleMs?: number;
  now?: () => Date;
}

const VIEWPORT = { width: 1920, height: 1080 } as const; // FR-004: 16:9 capture
const DEFAULT_SETTLE_MS = 700; // covers the default slide transition (~550ms)

/**
 * 015 US2: the worker-side export. Re-reads the deck and re-verifies the revision
 * (the deck may have moved on between accept and pickup — FR-003a fails explicitly
 * rather than exporting something the user did not request), screenshots every
 * slide, assembles the .pptx, and stores the artifact. Any failure marks the job
 * failed AND removes the partial artifact (FR-005/FR-018: no half-finished
 * downloads, no stray temp files).
 */
export async function runPptxExportJob({
  store,
  deckStore,
  artifacts,
  screenshotter,
  job,
  logger,
  settleMs = DEFAULT_SETTLE_MS,
  now = () => new Date()
}: RunPptxExportJobInput): Promise<void> {
  await store.markProcessing(job.id, now());

  try {
    const deck = await deckStore.findByIdForAccount(job.accountId, job.deckId);
    const revision = deck?.currentRevision;
    if (!revision || revision.revision !== job.revision || !revision.html) {
      throw new Error(
        `revision ${job.revision} is no longer current for deck ${job.deckId} (or has no html)`
      );
    }

    const pngs = await screenshotter.capture(revision.html, { ...VIEWPORT, settleMs });
    if (pngs.length === 0) {
      throw new Error("deck rendered zero slides");
    }
    const pptx = await buildPptxFromImages(pngs);
    const { artifactRef, byteSize } = await artifacts.write(job.id, pptx);

    await store.markDone(job.id, { artifactRef, byteSize, pageCount: pngs.length }, now());
    logger.log(`${job.id} done pages=${pngs.length} bytes=${byteSize}`);
  } catch (error) {
    // Failure path: sanitized failure on the job + partial artifact removal.
    await artifacts.delete(`${job.id}.pptx`).catch(() => undefined);
    await store.markFailed(job.id, createPptxExportFailure(error), now());
    logger.error(`${job.id} failed code=PPTX_EXPORT_FAILED`);
  }
}
