import { describe, expect, it } from "vitest";
import {
  PptxExportJobService,
  createPptxTimeoutFailure
} from "@/pptx-export-job/pptx-export-job.service";
import {
  deserializePptxExportJob,
  serializePptxExportJob
} from "@/pptx-export-job/pptx-export-job-serialization";
import {
  PPTX_EXPORT_JOB_TIMEOUT_MS,
  PPTX_MAX_PAGES,
  hasPptxExportJobTimedOut
} from "@/pptx-export-job/pptx-export-job-timeout";

const T0 = new Date("2026-06-13T00:00:00.000Z");

function service(now: Date = T0) {
  return new PptxExportJobService({ idFactory: () => "pptx_job_1", now: () => now });
}

function accepted() {
  return service().createAcceptedJob({
    accountId: "acc-1",
    deckId: "deck-1",
    revision: 3,
    pageCount: 12
  });
}

/**
 * 015 US2 (FR-020): the four-state machine — queued → processing → done | failed —
 * with terminal-state immutability, mirroring the preview-job model.
 */
describe("PptxExportJobService", () => {
  it("creates an accepted job bound to account/deck/revision", () => {
    const job = accepted();
    expect(job).toMatchObject({
      id: "pptx_job_1",
      status: "queued",
      accountId: "acc-1",
      deckId: "deck-1",
      revision: 3,
      pageCount: 12
    });
    expect(job.expiresAt.getTime()).toBeGreaterThan(job.createdAt.getTime());
  });

  it("walks queued → processing → done with the result attached", () => {
    const s = service();
    const done = s.markDone(s.markProcessing(accepted()), {
      artifactRef: "pptx/acc-1/pptx_job_1.pptx",
      byteSize: 1024,
      pageCount: 12
    });
    expect(done.status).toBe("done");
    expect(done.result?.artifactRef).toBe("pptx/acc-1/pptx_job_1.pptx");
  });

  it("marks failed with the failure reason (timeout reason for sweeper kills)", () => {
    const s = service();
    const failed = s.markFailed(s.markProcessing(accepted()), createPptxTimeoutFailure());
    expect(failed.status).toBe("failed");
    expect(failed.failure?.reason).toBe("timeout");
  });

  it("terminal states are immutable (no resurrection)", () => {
    const s = service();
    const done = s.markDone(s.markProcessing(accepted()), {
      artifactRef: "x",
      byteSize: 1,
      pageCount: 1
    });
    expect(s.markFailed(done, createPptxTimeoutFailure())).toBe(done);
    expect(s.markProcessing(done)).toBe(done);
  });
});

describe("pptx export job serialization", () => {
  it("round-trips through JSON with Date fields restored", () => {
    const job = service().markProcessing(accepted());
    const restored = deserializePptxExportJob(JSON.stringify(serializePptxExportJob(job)));
    expect(restored).toEqual(job);
    expect(restored.createdAt).toBeInstanceOf(Date);
  });

  it("rejects a record with an unknown status", () => {
    const raw = { ...serializePptxExportJob(accepted()), status: "exploded" };
    expect(() => deserializePptxExportJob(JSON.stringify(raw))).toThrow(/unknown status/);
  });
});

describe("pptx export job timeout", () => {
  it("times out a non-terminal job after the limit; terminal jobs never time out", () => {
    const job = accepted();
    const after = new Date(T0.getTime() + PPTX_EXPORT_JOB_TIMEOUT_MS);
    expect(hasPptxExportJobTimedOut(job, after)).toBe(true);
    expect(hasPptxExportJobTimedOut(job, new Date(T0.getTime() + 1000))).toBe(false);

    const s = service();
    const done = s.markDone(s.markProcessing(job), { artifactRef: "x", byteSize: 1, pageCount: 1 });
    expect(hasPptxExportJobTimedOut(done, after)).toBe(false);
  });

  it("exposes the page cap (FR-019)", () => {
    expect(PPTX_MAX_PAGES).toBe(60);
  });
});
