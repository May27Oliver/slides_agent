import { describe, expect, it } from "vitest";
import {
  deserializePreviewJob,
  serializePreviewJob
} from "@/preview-job/preview-job-serialization";
import type { PreviewJob } from "@/preview-job/preview-job.types";

function sampleJob(overrides: Partial<PreviewJob> = {}): PreviewJob {
  return {
    id: "preview_job_abc",
    status: "running",
    stage: "design_planning",
    createdAt: new Date("2026-06-03T10:00:00.000Z"),
    updatedAt: new Date("2026-06-03T10:01:30.000Z"),
    expiresAt: new Date("2026-06-03T10:10:00.000Z"),
    request: {
      sourceContent: "Source",
      deckBrief: { purpose: "Review", audience: "Team" }
    },
    evidence: {
      acceptedAt: "2026-06-03T10:00:00.000Z",
      stageTransitions: [
        { stage: "request_accepted", at: "2026-06-03T10:00:00.000Z" },
        { stage: "design_planning", at: "2026-06-03T10:01:30.000Z" }
      ],
      validationAccepted: true,
      fallbackUsed: false,
      repairAttempted: false,
      finalStatus: "running"
    },
    ...overrides
  };
}

describe("preview job serialization", () => {
  it("round-trips a job through JSON without losing data", () => {
    const job = sampleJob();

    const restored = deserializePreviewJob(JSON.stringify(serializePreviewJob(job)));

    expect(restored).toEqual(job);
    expect(restored.createdAt).toBeInstanceOf(Date);
    expect(restored.updatedAt).toBeInstanceOf(Date);
    expect(restored.expiresAt).toBeInstanceOf(Date);
  });

  it("serializes Date fields to ISO strings", () => {
    const serialized = serializePreviewJob(sampleJob());

    expect(serialized.createdAt).toBe("2026-06-03T10:00:00.000Z");
    expect(serialized.updatedAt).toBe("2026-06-03T10:01:30.000Z");
    expect(serialized.expiresAt).toBe("2026-06-03T10:10:00.000Z");
  });

  it("round-trips a succeeded job with result", () => {
    const job = sampleJob({
      status: "succeeded",
      stage: "completed",
      result: {
        slideDeck: { id: "deck_1" },
        designPlanningResult: { ok: true },
        previewArtifact: { html: "<!doctype html>" }
      }
    });

    const restored = deserializePreviewJob(serializePreviewJob(job));

    expect(restored).toEqual(job);
  });

  it("accepts both a JSON string and a parsed object", () => {
    const serialized = serializePreviewJob(sampleJob());

    expect(deserializePreviewJob(serialized)).toEqual(
      deserializePreviewJob(JSON.stringify(serialized))
    );
  });

  it("throws on structurally invalid input", () => {
    expect(() => deserializePreviewJob("not json")).toThrow();
    expect(() => deserializePreviewJob({ id: "x" })).toThrow();
    expect(() =>
      deserializePreviewJob({ ...serializePreviewJob(sampleJob()), createdAt: "nonsense-date" })
    ).toThrow();
  });

  it("rejects unknown status / stage enum values (corrupted record)", () => {
    expect(() =>
      deserializePreviewJob({ ...serializePreviewJob(sampleJob()), status: "bogus" })
    ).toThrow(/status/u);
    expect(() =>
      deserializePreviewJob({ ...serializePreviewJob(sampleJob()), stage: "bogus" })
    ).toThrow(/stage/u);
  });
});
