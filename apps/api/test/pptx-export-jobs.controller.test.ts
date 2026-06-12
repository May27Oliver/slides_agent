import { describe, expect, it } from "vitest";
import {
  BadRequestException,
  ConflictException,
  NotFoundException
} from "@nestjs/common";
import type {
  DeckDetail,
  DeckStore,
  PptxExportJob,
  PptxExportJobRunner,
  PptxExportJobStore
} from "@slides-agent/domain";
import type { PptxArtifactStore } from "@/modules/pptx-export-jobs/fs-pptx-artifact-store";
import { PptxExportJobsController } from "@/modules/pptx-export-jobs/pptx-export-jobs.controller";
import {
  renderableDesignPlan,
  renderableGenerationSummary,
  renderableSlideDeck
} from "./helpers/renderable-deck";

const DECK_ID = "11111111-2222-3333-4444-555555555555";
const reqFor = (id: string) => ({ user: { id, username: "u", displayName: "U", expiresAt: "z" } });

function deckDetail(revision = 3): DeckDetail {
  return {
    id: DECK_ID,
    title: "Q3 報告",
    status: "ready",
    sourceContent: "s",
    deckBrief: { purpose: "p", audience: "a" },
    currentRevision: {
      revision,
      slideDeck: renderableSlideDeck,
      designPlan: renderableDesignPlan,
      html: "<deck/>",
      generationSummary: renderableGenerationSummary,
      chartIntents: null,
      origin: "edit",
      sourceJobId: null,
      createdAt: "2026-06-13T00:00:00.000Z"
    }
  };
}

function job(overrides: Partial<PptxExportJob> = {}): PptxExportJob {
  return {
    id: "pptx_job_1",
    accountId: "acc-1",
    deckId: DECK_ID,
    revision: 3,
    pageCount: 1,
    status: "queued",
    createdAt: new Date("2026-06-13T00:00:00.000Z"),
    updatedAt: new Date("2026-06-13T00:00:00.000Z"),
    expiresAt: new Date("2026-06-13T00:30:00.000Z"),
    ...overrides
  };
}

function makeDeckStore(overrides: Partial<DeckStore> = {}): DeckStore {
  return {
    saveNewDeck: async () => ({ deckId: "x" }),
    listByAccount: async () => [],
    findByIdForAccount: async () => deckDetail(),
    appendEditRevision: async () => ({ ok: false, conflict: { currentRevision: 1 } }),
    ...overrides
  } as DeckStore;
}

function makeJobStore(overrides: Partial<PptxExportJobStore> = {}): PptxExportJobStore {
  return {
    create: async (j) => j,
    findById: async () => undefined,
    listActiveJobIds: async () => [],
    findActiveByAccount: async () => undefined,
    markProcessing: async () => undefined,
    markDone: async () => undefined,
    markFailed: async () => undefined,
    expireOldJobs: async () => [],
    ...overrides
  };
}

const noopRunner: PptxExportJobRunner = { start: async () => undefined };

function makeArtifacts(overrides: Partial<PptxArtifactStore> = {}): PptxArtifactStore {
  return {
    write: async () => ({ artifactRef: "x.pptx", byteSize: 1 }),
    read: async () => undefined,
    delete: async () => undefined,
    purgeOlderThan: async () => 0,
    ...overrides
  };
}

function controller(deps: {
  deckStore?: DeckStore;
  jobStore?: PptxExportJobStore;
  runner?: PptxExportJobRunner;
  artifacts?: PptxArtifactStore;
}) {
  return new PptxExportJobsController(
    deps.deckStore ?? makeDeckStore(),
    deps.jobStore ?? makeJobStore(),
    deps.runner ?? noopRunner,
    deps.artifacts ?? makeArtifacts()
  );
}

describe("PptxExportJobsController.createExport (015 US2)", () => {
  it("accepts a valid request → 202 with a queued job + statusUrl", async () => {
    let started = false;
    const response = await controller({
      runner: { start: async () => void (started = true) }
    }).createExport(DECK_ID, { revision: 3 }, reqFor("acc-1"));

    expect(response.status).toBe("queued");
    expect(response.statusUrl).toBe(`/api/decks/${DECK_ID}/pptx-exports/${response.jobId}`);
    expect(started).toBe(true);
  });

  it("404s for a deck the account does not own (existence hidden)", async () => {
    const c = controller({
      deckStore: makeDeckStore({ findByIdForAccount: async () => null })
    });
    await expect(c.createExport(DECK_ID, { revision: 3 }, reqFor("intruder"))).rejects.toThrow(
      NotFoundException
    );
  });

  it("400s when the requested revision is no longer current (FR-003a)", async () => {
    await expect(
      controller({}).createExport(DECK_ID, { revision: 2 }, reqFor("acc-1"))
    ).rejects.toThrow(BadRequestException);
  });

  it("409s when the account already has an in-flight export (single-flight, FR-006)", async () => {
    const c = controller({
      jobStore: makeJobStore({ findActiveByAccount: async () => job({ status: "processing" }) })
    });
    await expect(c.createExport(DECK_ID, { revision: 3 }, reqFor("acc-1"))).rejects.toThrow(
      ConflictException
    );
  });

  it("rejects a malformed body (revision missing)", async () => {
    await expect(controller({}).createExport(DECK_ID, {}, reqFor("acc-1"))).rejects.toThrow(
      BadRequestException
    );
  });
});

describe("PptxExportJobsController.exportStatus / downloadArtifact (015 US2)", () => {
  it("returns the four-state status with downloadUrl only when done", async () => {
    const done = job({
      status: "done",
      result: { artifactRef: "pptx_job_1.pptx", byteSize: 9, pageCount: 1 }
    });
    const c = controller({ jobStore: makeJobStore({ findById: async () => done }) });

    const status = await c.exportStatus(DECK_ID, "pptx_job_1", reqFor("acc-1"));
    expect(status.status).toBe("done");
    expect(status.downloadUrl).toBe(`/api/decks/${DECK_ID}/pptx-exports/pptx_job_1/file`);
  });

  it("404s a status read from a non-owner or wrong deck (isolation, FR-017)", async () => {
    const c = controller({ jobStore: makeJobStore({ findById: async () => job() }) });
    await expect(c.exportStatus(DECK_ID, "pptx_job_1", reqFor("intruder"))).rejects.toThrow(
      NotFoundException
    );
    await expect(
      c.exportStatus("99999999-9999-9999-9999-999999999999", "pptx_job_1", reqFor("acc-1"))
    ).rejects.toThrow(NotFoundException);
  });

  it("404s the file while the job is not done (no half-finished downloads, FR-005)", async () => {
    const c = controller({
      jobStore: makeJobStore({ findById: async () => job({ status: "processing" }) })
    });
    const res = { setHeader: () => undefined } as never;
    await expect(c.downloadArtifact(DECK_ID, "pptx_job_1", reqFor("acc-1"), res)).rejects.toThrow(
      NotFoundException
    );
  });

  it("404s the file when the artifact was purged by its TTL (FR-018)", async () => {
    const done = job({
      status: "done",
      result: { artifactRef: "pptx_job_1.pptx", byteSize: 9, pageCount: 1 }
    });
    const c = controller({
      jobStore: makeJobStore({ findById: async () => done }),
      artifacts: makeArtifacts({ read: async () => undefined })
    });
    const res = { setHeader: () => undefined } as never;
    await expect(c.downloadArtifact(DECK_ID, "pptx_job_1", reqFor("acc-1"), res)).rejects.toThrow(
      NotFoundException
    );
  });
});
