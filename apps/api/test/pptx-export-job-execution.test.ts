import { describe, expect, it } from "vitest";
import type { DeckDetail, PptxExportFailure, PptxExportJob, PptxExportResult } from "@slides-agent/domain";
import type { PptxArtifactStore } from "@/modules/pptx-export-jobs/fs-pptx-artifact-store";
import { runPptxExportJob } from "@/modules/pptx-export-jobs/pptx-export-job-execution";
import {
  renderableDesignPlan,
  renderableGenerationSummary,
  renderableSlideDeck
} from "./helpers/renderable-deck";

const PNG = Buffer.from("89504e47", "hex"); // any bytes — the builder b64-encodes them

function job(): PptxExportJob {
  return {
    id: "pptx_job_1",
    accountId: "acc-1",
    deckId: "deck-1",
    revision: 3,
    pageCount: 1,
    status: "queued",
    createdAt: new Date("2026-06-13T00:00:00.000Z"),
    updatedAt: new Date("2026-06-13T00:00:00.000Z"),
    expiresAt: new Date("2026-06-13T00:30:00.000Z")
  };
}

function deckDetail(revision = 3, html: string | null = "<deck/>"): DeckDetail {
  return {
    id: "deck-1",
    title: "t",
    status: "ready",
    sourceContent: "s",
    deckBrief: { purpose: "p", audience: "a" },
    currentRevision: {
      revision,
      slideDeck: renderableSlideDeck,
      designPlan: renderableDesignPlan,
      html,
      generationSummary: renderableGenerationSummary,
      chartIntents: null,
      origin: "edit",
      sourceJobId: null,
      createdAt: "2026-06-13T00:00:00.000Z"
    }
  };
}

interface Recorded {
  processing: boolean;
  done?: PptxExportResult;
  failed?: PptxExportFailure;
  deletedRefs: string[];
  written: Array<{ jobId: string; bytes: number }>;
}

function harness(options: {
  deck?: DeckDetail | null;
  captures?: Buffer[];
  captureError?: Error;
}) {
  const recorded: Recorded = { processing: false, deletedRefs: [], written: [] };
  const store = {
    markProcessing: async () => void (recorded.processing = true) as never,
    markDone: async (_id: string, result: PptxExportResult) =>
      void (recorded.done = result) as never,
    markFailed: async (_id: string, failure: PptxExportFailure) =>
      void (recorded.failed = failure) as never
  };
  const artifacts: PptxArtifactStore = {
    write: async (jobId, data) => {
      recorded.written.push({ jobId, bytes: data.byteLength });
      return { artifactRef: `${jobId}.pptx`, byteSize: data.byteLength };
    },
    read: async () => undefined,
    delete: async (ref) => void recorded.deletedRefs.push(ref),
    purgeOlderThan: async () => 0
  };
  const screenshotter = {
    capture: async () => {
      if (options.captureError) {
        throw options.captureError;
      }
      return options.captures ?? [PNG];
    }
  };
  const deckStore = { findByIdForAccount: async () => options.deck ?? deckDetail() };
  const logger = { log: () => undefined, error: () => undefined };
  return { recorded, run: () =>
    runPptxExportJob({ store, deckStore, artifacts, screenshotter, job: job(), logger, settleMs: 0 })
  };
}

describe("runPptxExportJob (015 US2 worker)", () => {
  it("captures every slide, writes the artifact, and marks done", async () => {
    const h = harness({ captures: [PNG, PNG] });
    await h.run();
    expect(h.recorded.processing).toBe(true);
    expect(h.recorded.done).toMatchObject({ artifactRef: "pptx_job_1.pptx", pageCount: 2 });
    expect(h.recorded.written[0]!.bytes).toBeGreaterThan(0);
    expect(h.recorded.failed).toBeUndefined();
  });

  it("fails explicitly when the revision moved on between accept and pickup (FR-003a)", async () => {
    const h = harness({ deck: deckDetail(4) });
    await h.run();
    expect(h.recorded.failed?.reason).toBe("export");
    expect(h.recorded.done).toBeUndefined();
  });

  it("on a capture crash: marks failed and removes the partial artifact (FR-005/FR-018)", async () => {
    const h = harness({ captureError: new Error("chromium died") });
    await h.run();
    expect(h.recorded.failed?.reason).toBe("export");
    expect(h.recorded.deletedRefs).toContain("pptx_job_1.pptx");
    expect(h.recorded.done).toBeUndefined();
  });

  it("fails when the deck renders zero slides", async () => {
    const h = harness({ captures: [] });
    await h.run();
    expect(h.recorded.failed?.reason).toBe("export");
  });
});
