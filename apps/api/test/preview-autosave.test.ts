import { describe, expect, it, vi } from "vitest";
import type { Deck, DeckStore, PreviewJob } from "@slides-agent/domain";
import { runPreviewJobGeneration } from "@/modules/preview-jobs/preview-job-execution";

const silentLogger = { log: () => undefined, error: () => undefined };

function makeJob(accountId?: string): PreviewJob {
  const now = new Date();
  return {
    id: "preview_job_1",
    status: "queued",
    stage: "request_accepted",
    createdAt: now,
    updatedAt: now,
    expiresAt: new Date(now.getTime() + 600_000),
    request: {
      sourceContent: "x",
      deckBrief: { purpose: "p", audience: "a" },
      ...(accountId ? { accountId } : {})
    },
    evidence: {
      acceptedAt: now.toISOString(),
      stageTransitions: [],
      validationAccepted: true,
      fallbackUsed: false,
      repairAttempted: false,
      finalStatus: "queued"
    }
  };
}

// Minimal store: returns the same job (non-timed-out) so generation reaches success.
function makeStore(job: PreviewJob) {
  return {
    markRunning: vi.fn(async () => job),
    markStage: vi.fn(async () => job),
    markSucceeded: vi.fn(async () => job),
    markFailed: vi.fn(async () => job)
  };
}

const slidesService = {
  generatePreview: async (_req: unknown, opts?: { onStage?: (stage: string) => Promise<void> }) => {
    await opts?.onStage?.("content_planning");
    return {
      slideDeck: { title: "T" },
      designPlanningResult: {},
      previewArtifact: { html: "<html></html>", generationSummary: {} }
    };
  }
};

function makeDeckStore(saveImpl: () => Promise<{ deckId: string }>): DeckStore {
  return {
    saveNewDeck: vi.fn(saveImpl),
    listByAccount: vi.fn(),
    findByIdForAccount: vi.fn()
  } as unknown as DeckStore;
}

describe("preview job auto-save (006 US2)", () => {
  it("persists a deck for the owning account on success", async () => {
    const job = makeJob("user_owner");
    const store = makeStore(job);
    const deckStore = makeDeckStore(async () => ({ deckId: "d1" }));

    await runPreviewJobGeneration({
      store: store as never,
      slidesService: slidesService as never,
      job,
      deckStore,
      logger: silentLogger
    });

    expect(store.markSucceeded).toHaveBeenCalledOnce();
    expect(deckStore.saveNewDeck).toHaveBeenCalledOnce();
    const saved = (deckStore.saveNewDeck as ReturnType<typeof vi.fn>).mock.calls[0][0] as Deck;
    expect(saved.accountId).toBe("user_owner");
    expect(saved.revision.sourceJobId).toBe("preview_job_1");
    expect(saved.revision.origin).toBe("generation");
  });

  it("does not persist when the job has no accountId", async () => {
    const job = makeJob(undefined);
    const store = makeStore(job);
    const deckStore = makeDeckStore(async () => ({ deckId: "d1" }));

    await runPreviewJobGeneration({
      store: store as never,
      slidesService: slidesService as never,
      job,
      deckStore,
      logger: silentLogger
    });

    expect(store.markSucceeded).toHaveBeenCalledOnce();
    expect(deckStore.saveNewDeck).not.toHaveBeenCalled();
  });

  it("keeps the job succeeded when deck persistence fails (logs, does not fail)", async () => {
    const job = makeJob("user_owner");
    const store = makeStore(job);
    const logger = { log: vi.fn(), error: vi.fn() };
    const deckStore = makeDeckStore(async () => {
      throw new Error("db down");
    });

    await runPreviewJobGeneration({
      store: store as never,
      slidesService: slidesService as never,
      job,
      deckStore,
      logger
    });

    expect(store.markSucceeded).toHaveBeenCalledOnce();
    expect(store.markFailed).not.toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining("deck_persist_failed"));
  });
});
